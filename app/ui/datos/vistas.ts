import type { Filtro } from "./filtros";

export type Vista = { nombre: string; filtro: Filtro; agrupar: "estado" | "persona" };
export const RUTA_VISTAS = "app/vistas.json";

export const POR_DEFECTO: Vista[] = [
  { nombre: "Esta semana", filtro: { vence: "semana" }, agrupar: "estado" },
  { nombre: "Todo", filtro: {}, agrupar: "estado" },
  { nombre: "Atrasado", filtro: { vence: "atrasado" }, agrupar: "estado" },
  { nombre: "Esperando al cliente", filtro: { esperandoCliente: true }, agrupar: "estado" },
];

/** Contenido de `app/vistas.json` (null si no existe) → vistas; si no se puede leer, las por defecto. */
export function parsearVistas(texto: string | null): Vista[] {
  if (texto === null) return POR_DEFECTO;
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x?.nombre === "string" && typeof x?.filtro === "object")
      ? (v as Vista[]) : POR_DEFECTO;
  } catch {
    return POR_DEFECTO;
  }
}

export const leerVistas = (): Promise<Vista[]> =>
  window.aos.repo.read(RUTA_VISTAS).then(parsearVistas, () => POR_DEFECTO);

export const guardarVistas = (vs: Vista[]): Promise<void> =>
  window.aos.repo.write(RUTA_VISTAS, `${JSON.stringify(vs, null, 2)}\n`);

/** Mismo filtro y agrupación (sin importar el orden de las claves ni las listas vacías). */
export const igual = (a: Omit<Vista, "nombre">, b: Omit<Vista, "nombre">): boolean => {
  const norma = (f: Filtro) => JSON.stringify(Object.entries(f).filter(([, v]) => v !== undefined && v !== false).sort());
  return a.agrupar === b.agrupar && norma(a.filtro) === norma(b.filtro);
};
