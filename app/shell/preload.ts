import { contextBridge, ipcRenderer } from "electron";
import type { Estado, EventoChat, PedidoApp, Puente } from "../shared/puente";

// El preload corre en sandbox (solo puede requerir "electron"): la versión llega por argv desde main.
const shellVersion = Number(process.argv.find((a) => a.startsWith("--aos-shell="))?.split("=")[1]);

let estadoSync = ipcRenderer.sendSync("sync:estado") as Estado;
ipcRenderer.on("sync:cambio", (_e, e: Estado) => (estadoSync = e));
let pausas = 0;

const puente: Puente = {
  shellVersion,
  repo: {
    list: (glob) => ipcRenderer.invoke("repo:list", glob),
    read: (ruta) => ipcRenderer.invoke("repo:read", ruta),
    write: (ruta, contenido) => ipcRenderer.invoke("repo:write", ruta, contenido),
    writeBase64: (ruta, base64) => ipcRenderer.invoke("repo:write-base64", ruta, base64),
    move: (de, a) => ipcRenderer.invoke("repo:move", de, a),
    delete: (ruta) => ipcRenderer.invoke("repo:delete", ruta),
    onCambio: (cb) => {
      const escucha = (_e: unknown, rutas: string[]) => cb(rutas);
      ipcRenderer.on("repo:cambio", escucha);
      return () => ipcRenderer.removeListener("repo:cambio", escucha);
    },
  },
  sync: {
    estado: () => estadoSync,
    onEstado: (cb) => {
      const escucha = (_e: unknown, e: Estado) => cb(e);
      ipcRenderer.on("sync:cambio", escucha);
      return () => ipcRenderer.removeListener("sync:cambio", escucha);
    },
    ahora: (mensaje) => ipcRenderer.invoke("sync:ahora", mensaje),
    enCurso: () => ipcRenderer.invoke("sync:en-curso"),
    pausar: () => {
      const id = ++pausas;
      ipcRenderer.send("sync:pausar", id);
      return () => ipcRenderer.send("sync:reanudar", id);
    },
  },
  persona: () => ipcRenderer.invoke("persona:leer"),
  guardarPersona: (slug) => ipcRenderer.invoke("persona:guardar", slug),
  config: {
    leer: () => ipcRenderer.invoke("config:leer"),
    guardar: (parcial) => ipcRenderer.invoke("config:guardar", parcial),
  },
  claude: {
    enviar: (id, mensaje, contexto) => ipcRenderer.invoke("claude:enviar", id, mensaje, contexto),
    onEvento: (cb) => {
      const escucha = (_e: unknown, id: string, ev: EventoChat) => cb(id, ev);
      ipcRenderer.on("claude:evento", escucha);
      return () => ipcRenderer.removeListener("claude:evento", escucha);
    },
    cancelar: (id) => ipcRenderer.send("claude:cancelar", id),
  },
  git: {
    log: (opts) => ipcRenderer.invoke("git:log", opts),
    show: (hash, ruta) => ipcRenderer.invoke("git:show", hash, ruta),
    yo: () => ipcRenderer.invoke("git:yo"),
  },
  sistema: {
    abrir: (url) => ipcRenderer.invoke("sistema:abrir", url),
    notificar: (a) => ipcRenderer.send("sistema:notificar", a),
    icono: (pendientes, atrasado) => ipcRenderer.send("sistema:icono", pendientes, atrasado),
    principal: (ruta) => ipcRenderer.send("sistema:principal", ruta),
    capturar: (texto) => ipcRenderer.invoke("sistema:capturar", texto),
    onPedido: (cb) => {
      // El shell guarda los pedidos hasta que esta ventana los toma: al empezar a escuchar y con cada aviso.
      const tomar = () => void ipcRenderer.invoke("app:tomar").then((ps: PedidoApp[]) => ps.forEach(cb));
      ipcRenderer.on("app:pedido", tomar);
      tomar();
      return () => ipcRenderer.removeListener("app:pedido", tomar);
    },
    onCaptura: (cb) => {
      const escucha = () => cb();
      ipcRenderer.on("barra:captura", escucha);
      return () => ipcRenderer.removeListener("barra:captura", escucha);
    },
    alto: (px) => ipcRenderer.send("sistema:alto", px),
    conectores: () => ipcRenderer.invoke("sistema:conectores"),
    cambiarRepo: () => ipcRenderer.invoke("sistema:cambiar-repo"),
    onNuevaUI: (cb) => {
      const escucha = () => cb();
      ipcRenderer.on("app:nueva-ui", escucha);
      return () => ipcRenderer.removeListener("app:nueva-ui", escucha);
    },
    recargar: () => ipcRenderer.send("sistema:recargar"),
  },
};
contextBridge.exposeInMainWorld("aos", puente);
