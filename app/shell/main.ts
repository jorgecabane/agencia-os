import { app, BrowserWindow, dialog } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { SHELL_VERSION } from "../shared/puente";
import { elegirUI } from "./cargar-ui";
import { guardarConfig, leerConfig } from "./config";

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
  ventana.on("closed", () => vigia.close());
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
