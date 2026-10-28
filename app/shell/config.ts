import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "../shared/puente";

export type { Config };

// AOS_DATOS solo lo pone la prueba de humo (carpeta temporal); se lee en cada llamada porque main lo fija al arrancar.
const rutaConfig = () => join(process.env.AOS_DATOS ?? join(homedir(), "Library", "Application Support", "agencia-os"), "config.json");

const POR_DEFECTO: Config = {
  repo: null,
  ultimoVisto: null,
  sesiones: {},
  avisos: { reuniones: true, actas: true, dia: true, menciones: true },
  yaAvisados: [],
  pausaHasta: null,
};

export function leerConfig(ruta = rutaConfig()): Config {
  try {
    const guardada = JSON.parse(readFileSync(ruta, "utf8")) as Partial<Config>;
    // `avisos` se mezcla clave a clave: un config viejo no trae los interruptores nuevos.
    return { ...structuredClone(POR_DEFECTO), ...guardada, avisos: { ...POR_DEFECTO.avisos, ...guardada.avisos } };
  } catch {
    return structuredClone(POR_DEFECTO);
  }
}

export function guardarConfig(cambios: Partial<Config>, ruta = rutaConfig()): void {
  mkdirSync(dirname(ruta), { recursive: true });
  const temporal = `${ruta}.tmp`;
  writeFileSync(temporal, JSON.stringify({ ...leerConfig(ruta), ...cambios }, null, 2));
  renameSync(temporal, ruta);
}
