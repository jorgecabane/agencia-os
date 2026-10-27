import { app, type BrowserWindow, type BrowserWindowConstructorOptions, globalShortcut, nativeImage, screen, Tray } from "electron";
import { join } from "node:path";

const ANCHO = 340;
const ALTO_INICIAL = 420;
const SEPARACION = 4; // px entre la barra de macOS y la ventana
const ATAJO_CAPTURA = "Alt+Space";
// Compilado a out/shell/: los íconos viven en shell/assets (el .app los incluye; ver electron-builder.yml).
// El sufijo "Template" hace que macOS lo pinte en blanco o negro según la barra.
const ICONO = join(__dirname, "..", "..", "shell", "assets", "trayTemplate.png");

/** Ícono en la barra de menú y su ventana (sin marco, bajo el ícono). La ventana se oculta, nunca se cierra. */
export function crearBarra(nueva: (o: BrowserWindowConstructorOptions) => BrowserWindow) {
  const tray = new Tray(nativeImage.createFromPath(ICONO));
  tray.setToolTip("agencia-os");
  const ventana = nueva({
    width: ANCHO, height: ALTO_INICIAL, show: false, frame: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true,
    // Calcula avisos cada minuto aunque esté oculta.
    webPreferences: { backgroundThrottling: false },
  });
  let saliendo = false;
  app.on("before-quit", () => (saliendo = true));
  ventana.on("close", (e) => {
    if (saliendo) return;
    e.preventDefault();
    ventana.hide();
  });
  ventana.on("blur", () => ventana.hide());

  const mostrar = () => {
    const b = tray.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    const x = Math.min(Math.max(Math.round(b.x + b.width / 2 - ANCHO / 2), area.x), area.x + area.width - ANCHO);
    ventana.setPosition(x, Math.round(b.y + b.height + SEPARACION));
    ventana.show();
    ventana.focus();
  };
  tray.on("click", () => (ventana.isVisible() ? ventana.hide() : mostrar()));
  // Si otra app ya usa ⌥Espacio, register devuelve false: la captura sigue disponible desde la ventana.
  globalShortcut.register(ATAJO_CAPTURA, () => {
    // Desde otra app, macOS no le da el foco del teclado a una ventana sin activar la app.
    app.focus({ steal: true });
    mostrar();
    ventana.webContents.send("barra:captura");
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());

  return {
    ventana,
    icono(pendientes: number, atrasado: boolean) {
      tray.setTitle(atrasado ? `${pendientes} ▲` : pendientes ? String(pendientes) : "");
    },
    alto(px: number) {
      const max = screen.getDisplayMatching(ventana.getBounds()).workArea.height - SEPARACION;
      ventana.setSize(ANCHO, Math.min(Math.max(Math.round(px), 1), max));
    },
    ocultar: () => ventana.hide(),
  };
}
