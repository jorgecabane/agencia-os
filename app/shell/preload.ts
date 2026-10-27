import { contextBridge, ipcRenderer } from "electron";
import type { Puente } from "../shared/puente";

// El preload corre en sandbox (solo puede requerir "electron"): la versión llega por argv desde main.
const shellVersion = Number(process.argv.find((a) => a.startsWith("--aos-shell="))?.split("=")[1]);

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
};
contextBridge.exposeInMainWorld("aos", puente);
