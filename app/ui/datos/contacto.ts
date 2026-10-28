import { diaDe, fechaLocal } from "./hoy";
import type { Indice } from "./indice";

/** Días sin una reunión con el cliente antes de avisar. */
export const UMBRAL_DIAS = 14;
const CON_ALERTA = new Set(["activo", "propuesta", "prospecto"]);
const DIA_MS = 86_400_000;
const aDate = (f: string) => new Date(`${f}T12:00:00`);
const entre = (desde: string, hasta: string) => Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / DIA_MS);

/** YYYY-MM-DD `n` días después de `f`. */
export const sumarDias = (f: string, n: number): string => {
  const d = aDate(f);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
};

/**
 * Alerta de contacto: la fecha en que quedamos ya pasó, o la última reunión (acta, no brief) es de hace más de UMBRAL_DIAS
 * y no hay un `proximo_contacto` por venir.
 * `dias` desde la última reunión (null si nunca hubo); `quedamos` = `proximo_contacto` si ya pasó.
 */
export function sinContacto(i: Indice, cliente: string, hoy: string): { dias: number | null; quedamos: string | null } | null {
  const c = i.clientes.find((x) => x.slug === cliente);
  if (!c || !CON_ALERTA.has(c.etapa)) return null;
  const ultimo = i.reuniones
    .filter((r) => r.cliente === cliente && r.tipo === "reunion")
    .map((r) => diaDe(r.fecha))
    .filter((d) => d <= hoy)
    .sort()
    .pop();
  const dias = ultimo ? entre(ultimo, hoy) : null;
  const p = c.proximo_contacto && String(c.proximo_contacto).slice(0, 10);
  const quedamos = p && p < hoy ? p : null;
  // Un proximo_contacto por venir ("Ya hablamos" lo pone en hoy + 14) calla el aviso por días.
  const porDias = dias !== null && dias > UMBRAL_DIAS && !(p && p >= hoy);
  return quedamos || porDias ? { dias, quedamos } : null;
}

/** "Sin contacto hace 16 días. Quedamos en hablar el 25 de octubre." */
export function textoContacto({ dias, quedamos }: { dias: number | null; quedamos: string | null }): string {
  const q = quedamos ? ` Quedamos en hablar el ${aDate(quedamos).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}.` : "";
  return (dias === null ? "Sin reuniones registradas." : `Sin contacto hace ${dias} días.`) + q;
}

/** Agrupa por mes ("Octubre"; "Enero 2027" si no es este año), ordenado por fecha. */
export function porMes<T>(items: T[], fecha: (x: T) => string, desc: boolean): { mes: string; items: T[] }[] {
  const año = fechaLocal().slice(0, 4);
  const orden = [...items].sort((a, b) => String(fecha(a)).localeCompare(String(fecha(b))) * (desc ? -1 : 1));
  const grupos: { clave: string; mes: string; items: T[] }[] = [];
  for (const x of orden) {
    const clave = diaDe(fecha(x)).slice(0, 7);
    if (grupos.at(-1)?.clave !== clave) {
      const m = aDate(`${clave}-01`).toLocaleDateString("es-CL", { month: "long" });
      grupos.push({ clave, mes: m[0].toUpperCase() + m.slice(1) + (clave.startsWith(año) ? "" : ` ${clave.slice(0, 4)}`), items: [] });
    }
    grupos.at(-1)?.items.push(x);
  }
  return grupos.map(({ mes, items: xs }) => ({ mes, items: xs }));
}
