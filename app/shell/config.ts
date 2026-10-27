import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "../shared/puente";

export type { Config };

const RUTA_CONFIG = join(homedir(), "Library", "Application Support", "agencia-os", "config.json");

const POR_DEFECTO: Config = {
  repo: null,
  ultimoVisto: null,
  sesiones: {},
  avisos: { reuniones: true, actas: true, dia: true },
  yaAvisados: [],
  pausaHasta: null,
};

export function leerConfig(ruta = RUTA_CONFIG): Config {
  try {
    return { ...structuredClone(POR_DEFECTO), ...JSON.parse(readFileSync(ruta, "utf8")) };
  } catch {
    return structuredClone(POR_DEFECTO);
  }
}

export function guardarConfig(cambios: Partial<Config>, ruta = RUTA_CONFIG): void {
  mkdirSync(dirname(ruta), { recursive: true });
  const temporal = `${ruta}.tmp`;
  writeFileSync(temporal, JSON.stringify({ ...leerConfig(ruta), ...cambios }, null, 2));
  renameSync(temporal, ruta);
}
