import type { Entregable } from "./tipos";

export type Vence = "hoy" | "semana" | "atrasado" | "todo";
export type Filtro = {
  personas?: string[]; clientes?: string[]; formatos?: string[]; estados?: string[];
  vence?: Vence; esperandoCliente?: boolean;
};

/** Estados en orden de columna; `cancelado` no se muestra en el tablero. */
export const ESTADOS = ["brief", "en_curso", "revision", "aprobado", "publicado"] as const;
const CERRADOS = new Set(["publicado", "cancelado"]);
const DIA_MS = 86_400_000;
const dias = (fecha: string, hoy: string) =>
  Math.round((Date.parse(String(fecha).slice(0, 10)) - Date.parse(hoy)) / DIA_MS);

/** Campo del filtro → campo del entregable. */
export const CAMPO = { personas: "responsable", clientes: "cliente", formatos: "formato", estados: "estado" } as const;
export type Lista = keyof typeof CAMPO;

const VENCE: Record<Vence, (e: Entregable, hoy: string) => boolean> = {
  hoy: (e, hoy) => dias(e.vence, hoy) === 0,
  // "Esta semana" es una ventana móvil: lo de los últimos 7 días y lo de los próximos 7.
  semana: (e, hoy) => Math.abs(dias(e.vence, hoy)) <= 7,
  atrasado: (e, hoy) => dias(e.vence, hoy) < 0 && !CERRADOS.has(e.estado),
  todo: () => true,
};

/** Entregables que pasan el filtro. Los cancelados nunca pasan. */
export function aplicar(es: Entregable[], f: Filtro, hoy: string): Entregable[] {
  const listas = (Object.keys(CAMPO) as Lista[]).filter((k) => f[k]?.length);
  return es.filter((e) =>
    e.estado !== "cancelado"
    && listas.every((k) => f[k]!.includes(String(e[CAMPO[k]])))
    && VENCE[f.vence ?? "todo"](e, hoy)
    // Esperando al cliente = en revisión: el cliente tiene que aprobar.
    && (!f.esperandoCliente || e.estado === "revision"));
}

/** Cuántos entregables hay por cada valor de `campo`. */
export function conteos(es: Entregable[], campo: keyof Entregable): Record<string, number> {
  const n: Record<string, number> = {};
  for (const e of es) n[String(e[campo])] = (n[String(e[campo])] ?? 0) + 1;
  return n;
}

/** Suma o quita `valor` de la lista `k`; una lista vacía desaparece del filtro. */
export function alternar(f: Filtro, k: Lista, valor: string): Filtro {
  const actual = f[k] ?? [];
  const nueva = actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor];
  return { ...f, [k]: nueva.length ? nueva : undefined };
}
