import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { SHELL_VERSION } from "../shared/puente";
import { elegirUI } from "./cargar-ui";
import { crearClaude } from "./claude";
import { type Config, guardarConfig, leerConfig } from "./config";
import * as git from "./git";
import { crearRepo } from "./repo";
import { correrSyncSh, crearPausas, crearSync, guardarPersona, leerPersona, personaGuardada } from "./sync";

const ESPERA_RECARGA_MS = 300;
const MENSAJE_APP = /^app: [^\n]{1,80}$/;

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

function cablearSync(ventana: BrowserWindow, raiz: string) {
  const sync = crearSync({
    correr: correrSyncSh(raiz),
    ahora: () => new Date(),
    persona: () => leerPersona(raiz),
  });
  const pausas = crearPausas(sync);
  const dueno = ventana.webContents.id;
  ipcMain.on("sync:estado", (e) => (e.returnValue = sync.estado()));
  ipcMain.handle("sync:ahora", (_e, mensaje?: unknown) =>
    sync.ahora(typeof mensaje === "string" && MENSAJE_APP.test(mensaje) ? mensaje : undefined));
  ipcMain.handle("sync:en-curso", () => sync.enCurso());
  ipcMain.on("sync:pausar", (e, id: number) => e.sender.id === dueno && pausas.pausar(dueno, id));
  ipcMain.on("sync:reanudar", (e, id: number) => e.sender.id === dueno && pausas.reanudar(dueno, id));
  ipcMain.handle("git:log", (_e, opts) => git.log(raiz, opts));
  ipcMain.handle("git:show", (_e, hash: string, ruta: string) => git.show(raiz, hash, ruta));
  ipcMain.handle("git:yo", () => git.yo(raiz));
  const quitar = sync.onEstado((e) => ventana.webContents.send("sync:cambio", e));
  ventana.on("focus", sync.foco);
  // Recargar la UI pierde sus ids de pausa: se liberan todas las del renderer anterior.
  const wc = ventana.webContents;
  wc.on("did-start-navigation", (d) => d.isMainFrame && !d.isSameDocument && pausas.soltar(dueno));
  wc.on("render-process-gone", () => pausas.soltar(dueno));
  ventana.on("closed", () => {
    quitar();
    sync.parar();
    pausas.soltar(dueno);
  });
  void sync.ahora(); // al abrir: traer lo del equipo
  return sync;
}

function cablearRepo(ventana: BrowserWindow, raiz: string): ReturnType<typeof cablearSync> {
  const repo = crearRepo(raiz);
  const sync = cablearSync(ventana, raiz);
  ipcMain.handle("repo:list", (_e, glob: string) => repo.list(glob));
  ipcMain.handle("repo:read", (_e, ruta: string) => repo.read(ruta));
  ipcMain.handle("repo:write", (_e, ruta: string, contenido: string) => repo.write(ruta, contenido).finally(sync.escribio));
  ipcMain.handle("repo:write-base64", (_e, ruta: string, base64: string) => repo.writeBase64(ruta, base64).finally(sync.escribio));
  ipcMain.handle("repo:move", (_e, de: string, a: string) => repo.move(de, a).finally(sync.escribio));
  ipcMain.handle("repo:delete", (_e, ruta: string) => repo.delete(ruta).finally(sync.escribio));
  const parar = repo.onCambio((rutas) => ventana.webContents.send("repo:cambio", rutas));
  ventana.on("closed", parar);
  return sync;
}

function cablearClaude(ventana: BrowserWindow, raiz: string, sync: ReturnType<typeof cablearSync>): void {
  const claude = crearClaude({
    raiz,
    persona: () => leerPersona(raiz),
    head: async () => (await git.log(raiz, { max: 1 }))[0]?.hash ?? null,
    sesiones: {
      leer: (id) => leerConfig().sesiones[id],
      guardar: (id, s) => guardarConfig({ sesiones: { ...leerConfig().sesiones, [id]: s } }),
    },
    sync,
  });
  const wc = ventana.webContents;
  ipcMain.handle("claude:enviar", (_e, id: string, mensaje: string, contexto: string, envio?: string[]) =>
    claude.enviar(id, mensaje, contexto, (ev) => !wc.isDestroyed() && wc.send("claude:evento", id, ev), envio));
  ipcMain.on("claude:cancelar", (_e, id: string) => claude.cancelar(id));
  ventana.on("closed", claude.cancelarTodo);
}

function cablearLocal(raiz: string): void {
  ipcMain.handle("persona:leer", () => personaGuardada(raiz));
  ipcMain.handle("persona:guardar", (_e, slug: string) => guardarPersona(raiz, slug));
  ipcMain.handle("config:leer", () => leerConfig());
  // La UI no cambia la carpeta del repo (eso lo pide el shell al abrir).
  ipcMain.handle("config:guardar", (_e, { repo: _repo, ...parcial }: Partial<Config>) => guardarConfig(parcial));
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
  cablearClaude(ventana, repo, cablearRepo(ventana, repo));
  cablearLocal(repo);
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
