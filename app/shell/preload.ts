import { contextBridge, ipcRenderer } from "electron";
import type { Estado, Puente } from "../shared/puente";

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
    ahora: () => ipcRenderer.invoke("sync:ahora"),
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
  git: {
    log: (opts) => ipcRenderer.invoke("git:log", opts),
    show: (hash, ruta) => ipcRenderer.invoke("git:show", hash, ruta),
    yo: () => ipcRenderer.invoke("git:yo"),
  },
};
contextBridge.exposeInMainWorld("aos", puente);
