import { app, BrowserWindow, type BrowserWindowConstructorOptions, dialog, ipcMain, Menu, Notification, shell } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { type PedidoApp, SHELL_VERSION } from "../shared/puente";
import { debeAvisar, esAviso, esHttps, recordar } from "./avisos";
import { crearBarra } from "./bandeja-menu";
import { elegirUI } from "./cargar-ui";
import { crearClaude } from "./claude";
import { type Config, guardarConfig, leerConfig } from "./config";
import { conectores } from "./sistema";
import * as git from "./git";
import { crearRepo } from "./repo";
import { correrSyncSh, crearPausas, crearSync, guardarPersona, leerPersona, personaGuardada } from "./sync";

const ESPERA_RECARGA_MS = 300;
const MENSAJE_APP = /^app: [^\n]{1,80}$/;

type Sync = ReturnType<typeof crearSync>;
type Pausas = ReturnType<typeof crearPausas>;
type Claude = ReturnType<typeof crearClaude>;
type Barra = ReturnType<typeof crearBarra>;

// La ventana principal se puede cerrar y volver a abrir; la app sigue en la barra de menú.
let principal: BrowserWindow | null = null;
// Lo que pidieron la barra o un aviso; la ventana principal lo toma al cargar o al recibir "app:pedido".
const pedidos: PedidoApp[] = [];
// Sin una referencia viva, el aviso se recolecta y su clic se pierde.
const avisosVivos = new Set<Notification>();

const aTodas = (canal: string, ...args: unknown[]) =>
  BrowserWindow.getAllWindows().forEach((v) => !v.webContents.isDestroyed() && v.webContents.send(canal, ...args));

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

function nuevaVentana(o: BrowserWindowConstructorOptions): BrowserWindow {
  const ventana = new BrowserWindow({
    backgroundColor: "#242322",
    ...o,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--aos-shell=${SHELL_VERSION}`],
      ...o.webPreferences,
    },
  });
  // Solo archivos locales: nunca navegar ni abrir ventanas hacia URLs remotas (los links van por sistema:abrir).
  ventana.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) e.preventDefault();
  });
  ventana.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  return ventana;
}

/** `hash` elige la pantalla: "barra" es la ventana de la barra de menú. */
function cargar(ventana: BrowserWindow, repo: string, hash?: string): void {
  const { ruta, aviso } = elegirUI(repo, SHELL_VERSION);
  void ventana.loadFile(ruta, { hash, ...(aviso ? { query: { aviso } } : {}) });
}

function vigilarUI(ventana: BrowserWindow, repo: string, hash?: string): void {
  const dist = join(repo, "app", "ui-dist");
  if (!existsSync(dist)) return;
  let pendiente: NodeJS.Timeout | undefined;
  const vigia = watch(dist, { recursive: true }, () => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => cargar(ventana, repo, hash), ESPERA_RECARGA_MS);
  });
  vigia.on("error", () => vigia.close());
  ventana.on("closed", () => vigia.close());
}

// Los ipcMain.handle se registran una sola vez al arrancar: cada pedido responde a su remitente (e.sender).
function cablearSync(raiz: string): { sync: Sync; pausas: Pausas } {
  const sync = crearSync({
    correr: correrSyncSh(raiz),
    ahora: () => new Date(),
    persona: () => leerPersona(raiz),
  });
  const pausas = crearPausas(sync);
  ipcMain.on("sync:estado", (e) => (e.returnValue = sync.estado()));
  ipcMain.handle("sync:ahora", (_e, mensaje?: unknown) =>
    sync.ahora(typeof mensaje === "string" && MENSAJE_APP.test(mensaje) ? mensaje : undefined));
  ipcMain.handle("sync:en-curso", () => sync.enCurso());
  ipcMain.on("sync:pausar", (e, id: number) => pausas.pausar(e.sender.id, id));
  ipcMain.on("sync:reanudar", (e, id: number) => pausas.reanudar(e.sender.id, id));
  ipcMain.handle("git:log", (_e, opts) => git.log(raiz, opts));
  ipcMain.handle("git:show", (_e, hash: string, ruta: string) => git.show(raiz, hash, ruta));
  ipcMain.handle("git:yo", () => git.yo(raiz));
  sync.onEstado((e) => aTodas("sync:cambio", e));
  app.on("before-quit", sync.parar);
  return { sync, pausas };
}

/** Recargar la UI o cerrar la ventana pierde sus ids de pausa: se liberan todas las de ese renderer. */
function soltarPausas(ventana: BrowserWindow, pausas: Pausas): void {
  const wc = ventana.webContents;
  const dueno = wc.id;
  wc.on("did-start-navigation", (d) => d.isMainFrame && !d.isSameDocument && pausas.soltar(dueno));
  wc.on("render-process-gone", () => pausas.soltar(dueno));
  ventana.on("closed", () => pausas.soltar(dueno));
}

function cablearRepo(raiz: string, sync: Sync): void {
  const repo = crearRepo(raiz);
  ipcMain.handle("repo:list", (_e, glob: string) => repo.list(glob));
  ipcMain.handle("repo:read", (_e, ruta: string) => repo.read(ruta));
  ipcMain.handle("repo:write", (_e, ruta: string, contenido: string) => repo.write(ruta, contenido).finally(sync.escribio));
  ipcMain.handle("repo:write-base64", (_e, ruta: string, base64: string) => repo.writeBase64(ruta, base64).finally(sync.escribio));
  ipcMain.handle("repo:move", (_e, de: string, a: string) => repo.move(de, a).finally(sync.escribio));
  ipcMain.handle("repo:delete", (_e, ruta: string) => repo.delete(ruta).finally(sync.escribio));
  repo.onCambio((rutas) => aTodas("repo:cambio", rutas));
}

function cablearClaude(raiz: string, sync: Sync): Claude {
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
  ipcMain.handle("claude:enviar", (e, id: string, mensaje: string, contexto: string) => {
    const wc = e.sender;
    return claude.enviar(id, mensaje, contexto, (ev) => !wc.isDestroyed() && wc.send("claude:evento", id, ev));
  });
  ipcMain.on("claude:cancelar", (_e, id: string) => claude.cancelar(id));
  app.on("before-quit", claude.cancelarTodo);
  return claude;
}

function cablearLocal(raiz: string): void {
  ipcMain.handle("persona:leer", () => personaGuardada(raiz));
  ipcMain.handle("persona:guardar", (_e, slug: string) => guardarPersona(raiz, slug));
  ipcMain.handle("config:leer", () => leerConfig());
  // La UI no cambia la carpeta del repo (eso lo pide el shell al abrir).
  ipcMain.handle("config:guardar", (_e, { repo: _repo, ...parcial }: Partial<Config>) => guardarConfig(parcial));
}

function notificar(a: unknown, pedir: (p: PedidoApp) => void): void {
  if (!esAviso(a)) return;
  const config = leerConfig();
  if (!debeAvisar(config, a.id, new Date())) return;
  guardarConfig({ yaAvisados: recordar(config.yaAvisados, a.id) });
  const aviso = new Notification({ title: a.titulo, body: a.texto });
  avisosVivos.add(aviso);
  aviso.on("click", () => { avisosVivos.delete(aviso); pedir({ ruta: a.ruta }); });
  aviso.on("close", () => avisosVivos.delete(aviso));
  aviso.show();
}

function cablearSistema(raiz: string, barra: Barra, claude: Claude, mostrar: () => BrowserWindow): void {
  const pedir = (p: PedidoApp) => {
    pedidos.push(p);
    barra.ocultar();
    mostrar().webContents.send("app:pedido");
  };
  ipcMain.handle("app:tomar", (e) => (e.sender === principal?.webContents ? pedidos.splice(0) : []));
  ipcMain.handle("sistema:abrir", async (_e, url: unknown) => {
    if (!esHttps(url)) throw new Error("Solo abro links https.");
    await shell.openExternal(String(url));
  });
  ipcMain.on("sistema:notificar", (_e, a: unknown) => notificar(a, pedir));
  ipcMain.on("sistema:icono", (_e, n: unknown, atrasado: unknown) => barra.icono(Number(n) || 0, atrasado === true));
  ipcMain.on("sistema:principal", (_e, ruta?: unknown) => {
    if (typeof ruta === "string") return pedir({ ruta });
    barra.ocultar();
    mostrar();
  });
  ipcMain.handle("sistema:capturar", (_e, texto: unknown) => {
    if (typeof texto !== "string" || !texto.trim() || claude.ocupado()) return false;
    pedir({ captura: texto.trim() });
    return true;
  });
  ipcMain.handle("sistema:conectores", () => conectores(raiz));
  ipcMain.handle("sistema:cambiar-repo", async () => {
    const repo = await pedirRepo();
    if (!repo) return false;
    guardarConfig({ repo });
    app.relaunch();
    app.exit(0);
    return true;
  });
  ipcMain.on("sistema:alto", (e, px: unknown) => {
    if (e.sender === barra.ventana.webContents && typeof px === "number") barra.alto(px);
  });
}

function crearPrincipal(raiz: string, sync: Sync, pausas: Pausas, claude: Claude): BrowserWindow {
  const ventana = nuevaVentana({ width: 1280, height: 820, titleBarStyle: "hiddenInset" });
  ventana.on("focus", sync.foco);
  soltarPausas(ventana, pausas);
  ventana.on("closed", () => {
    claude.cancelarTodo(); // el chat vive en esta ventana: ningún `claude` queda corriendo sin quien lo mire
    principal = null;
  });
  cargar(ventana, raiz);
  vigilarUI(ventana, raiz);
  void sync.ahora(); // al abrir: traer lo del equipo
  return ventana;
}

const menu = (mostrar: () => void) => Menu.buildFromTemplate([
  { role: "appMenu" },
  { label: "Archivo", submenu: [{ label: "Abrir agencia-os", accelerator: "CmdOrCtrl+O", click: mostrar }] },
  { role: "editMenu" },
  { role: "viewMenu" },
  { role: "windowMenu" },
]);

function arrancar(raiz: string): void {
  const { sync, pausas } = cablearSync(raiz);
  cablearRepo(raiz, sync);
  const claude = cablearClaude(raiz, sync);
  cablearLocal(raiz);
  const mostrar = (): BrowserWindow => {
    principal ??= crearPrincipal(raiz, sync, pausas, claude);
    if (principal.isMinimized()) principal.restore();
    principal.show();
    principal.focus();
    return principal;
  };
  const barra = crearBarra(nuevaVentana);
  soltarPausas(barra.ventana, pausas);
  cargar(barra.ventana, raiz, "barra");
  vigilarUI(barra.ventana, raiz, "barra");
  cablearSistema(raiz, barra, claude, mostrar);
  Menu.setApplicationMenu(menu(mostrar));
  app.on("activate", () => mostrar());
  mostrar();
}

app.whenReady().then(async () => {
  let { repo } = leerConfig();
  if (!repo) {
    repo = await pedirRepo();
    if (!repo) return app.quit();
    guardarConfig({ repo });
  }
  arrancar(repo);
});

// Con la ventana principal cerrada la app sigue en la barra de menú (⌘O o "Abrir agencia-os" la vuelven a abrir).
app.on("window-all-closed", () => {});
