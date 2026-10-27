import type { Indice } from "./indice";
import type { Entregable, Promesa, Reunion } from "./tipos";

const CERRADOS = new Set(["publicado", "cancelado"]);
const COLORES = ["#e0a060", "#7fb38a", "#9a8ad8", "#d78aa8", "#6fa8d8", "#c9b46a"];

/** Color estable por slug de cliente o persona (la ficha no trae color). */
export function colorPara(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

/** "clientes/acme/entregables/2026-10-30-carrusel-lanzamiento.md" → "Carrusel lanzamiento". */
export function titulo(ruta: string): string {
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
      .filter((r) => String(r.fecha).slice(0, 10) === fecha && (r.asistentes ?? []).includes(persona))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    entregas: mias.filter((e) => !e.fecha_tentativa && String(e.vence) <= fecha).sort(porVence),
    tentativas: mias.filter((e) => e.fecha_tentativa).sort(porVence),
    debeCliente: promesas.filter((p) => p.delCliente && !p.hecha && misClientes.has(clienteDeRuta(p.acta) ?? "")),
  };
}

/** Fecha local de hoy, YYYY-MM-DD. */
export const fechaLocal = (d = new Date()): string => d.toLocaleDateString("sv-SE");

const DIA_MS = 86_400_000;
const aDate = (f: string) => new Date(`${f}T12:00:00`);

/** "hoy", "ayer", "mañana" o "jue 29"; `tarde` si ya pasó. */
export function cuando(fecha: string, hoyF: string): { texto: string; tarde: boolean } {
  const f = String(fecha).slice(0, 10);
  const dias = Math.round((aDate(f).getTime() - aDate(hoyF).getTime()) / DIA_MS);
  const nombres: Record<number, string> = { [-1]: "ayer", 0: "hoy", 1: "mañana" };
  const texto = nombres[dias] ?? aDate(f).toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }).replace(".", "");
  return { texto, tarde: dias < 0 };
}
