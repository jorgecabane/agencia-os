import { contextBridge } from "electron";
import type { Puente } from "../shared/puente";

// El preload corre en sandbox (solo puede requerir "electron"): la versión llega por argv desde main.
const shellVersion = Number(process.argv.find((a) => a.startsWith("--aos-shell="))?.split("=")[1]);

const puente: Puente = { shellVersion };
contextBridge.exposeInMainWorld("aos", puente);
