import type { Indice } from "./indice";
import type { Entregable, Promesa, Reunion } from "./tipos";

const CERRADOS = new Set(["publicado", "cancelado"]);
const COLORES = [1, 2, 3, 4, 5, 6].map((n) => `var(--cliente-${n})`); // tokens.css

/** Color estable por slug de cliente o persona (la ficha no trae color). */
export function colorPara(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

// Título legible por ruta (frontmatter `titulo` o el primer `# `), lo llena el índice al leer cada archivo.
const titulos = new Map<string, string>();
export const registrarTitulo = (ruta: string, t: string | null): void => void (t ? titulos.set(ruta, t) : titulos.delete(ruta));

/** El título del archivo; si no tiene, sale del nombre: "…/2026-10-30-carrusel-lanzamiento.md" → "Carrusel lanzamiento". */
export function titulo(ruta: string): string {
  const registrado = titulos.get(ruta);
  if (registrado) return registrado;
  const base = (ruta.split("/").pop() ?? ruta).replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-?/, "");
  const t = base.replace(/-/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : base;
}

/** Slug del cliente según la ruta (`clientes/<c>/...`). */
export const clienteDeRuta = (ruta: string): string | null => /^clientes\/([^/]+)\//.exec(ruta)?.[1] ?? null;

/**
 * Lo que le toca hoy a `persona`. `promesas` vienen de las actas (promesasDeActa); el índice no lee cuerpos.
 */
export function hoy(i: Indice, persona: string, fecha: string, promesas: Promesa[] = []): {
  reuniones: Reunion[]; entregas: Entregable[]; tentativas: Entregable[]; debeCliente: Promesa[];
} {
  const mias = i.entregables.filter((e) => e.responsable === persona && !CERRADOS.has(e.estado));
  const porVence = (a: Entregable, b: Entregable) => a.vence.localeCompare(b.vence);
  const misClientes = new Set(i.clientes.filter((c) => c.responsable === persona).map((c) => c.slug));
  return {
    reuniones: i.reuniones
      .filter((r) => diaDe(r.fecha) === fecha && (r.asistentes ?? []).includes(persona))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    entregas: mias.filter((e) => !e.fecha_tentativa && String(e.vence) <= fecha).sort(porVence),
    tentativas: mias.filter((e) => e.fecha_tentativa).sort(porVence),
    debeCliente: promesas.filter((p) => p.delCliente && !p.hecha && misClientes.has(clienteDeRuta(p.acta) ?? "")),
  };
}

// Las horas se guardan en UTC (o con su offset) y se muestran en la zona de quien tiene la app abierta.
const SISTEMA = Intl.DateTimeFormat().resolvedOptions().timeZone;
let zona = SISTEMA;
const valida = (z: string) => { try { new Intl.DateTimeFormat("es-CL", { timeZone: z }); return true; } catch { return false; } };
/** La `zona_horaria` de la persona; sin una válida, la del Mac. */
export const fijarZona = (z?: string): void => void (zona = z && valida(z) ? z : SISTEMA);
export const zonaActual = (): string => zona;

/** Fecha de hoy en la zona de la persona, YYYY-MM-DD. */
export const fechaLocal = (d = new Date()): string => d.toLocaleDateString("sv-SE", { timeZone: zona });

const conHora = (f: string) => String(f).length > 10;
/** Día (YYYY-MM-DD) en la zona de la persona; una fecha sin hora queda igual. */
export const diaDe = (f: string): string => (conHora(f) ? fechaLocal(new Date(f)) : String(f).slice(0, 10));
/** "10:00" en la zona de la persona; "" si la fecha no trae hora. */
export const horaDe = (f: string): string =>
  conHora(f) ? new Date(f).toLocaleTimeString("es-CL", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";

const DIA_MS = 86_400_000;
const aDate = (f: string) => new Date(`${f}T12:00:00`);

/** "hoy", "ayer", "mañana" o "jue 29"; `tarde` si ya pasó. */
export function cuando(fecha: string, hoyF: string): { texto: string; tarde: boolean } {
  const f = diaDe(fecha);
  const dias = Math.round((aDate(f).getTime() - aDate(hoyF).getTime()) / DIA_MS);
  const nombres: Record<number, string> = { [-1]: "ayer", 0: "hoy", 1: "mañana" };
  const texto = nombres[dias] ?? aDate(f).toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }).replace(".", "");
  return { texto, tarde: dias < 0 };
}
