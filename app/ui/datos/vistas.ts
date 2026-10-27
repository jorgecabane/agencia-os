import type { Filtro } from "./filtros";

export type Vista = { nombre: string; filtro: Filtro; agrupar: "estado" | "persona" };
export const RUTA_VISTAS = "app/vistas.json";

export const POR_DEFECTO: Vista[] = [
  { nombre: "Esta semana", filtro: { vence: "semana" }, agrupar: "estado" },
  { nombre: "Todo", filtro: {}, agrupar: "estado" },
  { nombre: "Atrasado", filtro: { vence: "atrasado" }, agrupar: "estado" },
  { nombre: "Esperando al cliente", filtro: { esperandoCliente: true }, agrupar: "estado" },
];

/**
 * Contenido de `app/vistas.json` (null si no existe) → vistas. Si está roto lanza: tomarlo como las de fábrica
 * haría que el próximo guardado pise las del equipo.
 */
export function parsearVistas(texto: string | null): Vista[] {
  if (texto === null) return POR_DEFECTO;
  const v: unknown = JSON.parse(texto);
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x?.nombre === "string" && typeof x?.filtro === "object")) return v as Vista[];
  throw new Error("vistas.json no tiene vistas válidas");
}

export const ERROR_VISTAS = "No pude leer las vistas guardadas del equipo (revisa app/vistas.json). Mientras tanto no se pueden guardar vistas.";

/** Lanza si el archivo existe y no se puede leer o está roto. */
export async function leerVistas(): Promise<Vista[]> {
  const existe = (await window.aos.repo.list(RUTA_VISTAS)).length > 0;
  return parsearVistas(existe ? await window.aos.repo.read(RUTA_VISTAS) : null);
}

export const guardarVistas = (vs: Vista[]): Promise<void> =>
  window.aos.repo.write(RUTA_VISTAS, `${JSON.stringify(vs, null, 2)}\n`);

/** Mismo filtro y agrupación (sin importar el orden de claves ni de valores en las listas). */
export const igual = (a: Omit<Vista, "nombre">, b: Omit<Vista, "nombre">): boolean => {
  const norma = (f: Filtro) => JSON.stringify(Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])
    .sort(([a], [b]) => String(a).localeCompare(String(b))));
  return a.agrupar === b.agrupar && norma(a.filtro) === norma(b.filtro);
};
