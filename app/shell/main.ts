import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { SHELL_VERSION } from "../shared/puente";
import { elegirUI } from "./cargar-ui";
import { guardarConfig, leerConfig } from "./config";
import * as git from "./git";
import { crearRepo } from "./repo";
import { correrSyncSh, crearSync, leerPersona } from "./sync";

const ESPERA_RECARGA_MS = 300;

async function pedirRepo(): Promise<string | null> {
  for (;;) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Elige la carpeta de agencia-os",
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths[0]) return null;
    if (existsSync(join(filePaths[0], "CLAUDE.md"))) return filePaths[0];
    await dialog.showMessageBox({
      type: "warning",
      message: "Esa carpeta no es agencia-os",
      detail: "Elige la carpeta del repo, la que tiene el archivo CLAUDE.md.",
    });
  }
}

function cargar(ventana: BrowserWindow, repo: string): void {
  const { ruta, aviso } = elegirUI(repo, SHELL_VERSION);
  void ventana.loadFile(ruta, aviso ? { query: { aviso } } : undefined);
}

function vigilarUI(ventana: BrowserWindow, repo: string): void {
  const dist = join(repo, "app", "ui-dist");
  if (!existsSync(dist)) return;
  let pendiente: NodeJS.Timeout | undefined;
  const vigia = watch(dist, { recursive: true }, () => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => cargar(ventana, repo), ESPERA_RECARGA_MS);
  });
  vigia.on("error", () => vigia.close());
  ventana.on("closed", () => vigia.close());
}

function cablearSync(ventana: BrowserWindow, raiz: string): { escribio: () => void } {
  const sync = crearSync({
    correr: correrSyncSh(raiz),
    ahora: () => new Date(),
    persona: () => leerPersona(raiz),
  });
  const reanudar = new Map<number, () => void>();
  ipcMain.on("sync:estado", (e) => (e.returnValue = sync.estado()));
  ipcMain.handle("sync:ahora", () => sync.ahora());
  ipcMain.on("sync:pausar", (_e, id: number) => reanudar.set(id, sync.pausar()));
  ipcMain.on("sync:reanudar", (_e, id: number) => {
    reanudar.get(id)?.();
    reanudar.delete(id);
  });
  ipcMain.handle("git:log", (_e, opts) => git.log(raiz, opts));
  ipcMain.handle("git:show", (_e, hash: string, ruta: string) => git.show(raiz, hash, ruta));
  ipcMain.handle("git:yo", () => git.yo(raiz));
  const quitar = sync.onEstado((e) => ventana.webContents.send("sync:cambio", e));
  ventana.on("focus", sync.foco);
  ventana.on("closed", () => {
    quitar();
    sync.parar();
    reanudar.forEach((r) => r());
  });
  void sync.ahora(); // al abrir: traer lo del equipo
  return sync;
}

function cablearRepo(ventana: BrowserWindow, raiz: string): void {
  const repo = crearRepo(raiz);
  const sync = cablearSync(ventana, raiz);
  ipcMain.handle("repo:list", (_e, glob: string) => repo.list(glob));
  ipcMain.handle("repo:read", (_e, ruta: string) => repo.read(ruta));
  ipcMain.handle("repo:write", (_e, ruta: string, contenido: string) => repo.write(ruta, contenido).finally(sync.escribio));
  ipcMain.handle("repo:move", (_e, de: string, a: string) => repo.move(de, a).finally(sync.escribio));
  ipcMain.handle("repo:delete", (_e, ruta: string) => repo.delete(ruta).finally(sync.escribio));
  const parar = repo.onCambio((rutas) => ventana.webContents.send("repo:cambio", rutas));
  ventana.on("closed", parar);
}

function crearVentana(repo: string): void {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#242322",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--aos-shell=${SHELL_VERSION}`],
    },
  });
  // Solo archivos locales: nunca navegar ni abrir ventanas hacia URLs remotas.
  ventana.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) e.preventDefault();
  });
  ventana.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  cablearRepo(ventana, repo);
  cargar(ventana, repo);
  vigilarUI(ventana, repo);
}

app.whenReady().then(async () => {
  let { repo } = leerConfig();
  if (!repo) {
    repo = await pedirRepo();
    if (!repo) return app.quit();
    guardarConfig({ repo });
  }
  crearVentana(repo);
});

app.on("window-all-closed", () => app.quit());
