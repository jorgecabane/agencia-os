import { clienteDeRuta, diaDe, titulo } from "./hoy";
import type { Indice } from "./indice";
import type { Entregable, Promesa, Reunion } from "./tipos";

const CERRADOS = new Set(["publicado", "cancelado"]);
const MAX_LINEA = 10;
const sinComentarios = (t: string) => t.replace(/<!--[\s\S]*?-->/g, "");

/** Lo que el resumen lee de los cuerpos (el índice solo trae frontmatter). */
export type Cuerpos = { contexto?: string; linea?: string; promesas?: Promesa[] };

/** Viñetas bajo `## Lo que aprendimos` (los comentarios de la plantilla no cuentan). */
function aprendimosDe(contexto: string): string[] {
  let dentro = false;
  const vinetas: string[] = [];
  for (const l of sinComentarios(contexto).split(/\r?\n/)) {
    if (/^##\s/.test(l)) dentro = /^##\s+Lo que aprendimos\s*$/i.test(l);
    const v = dentro ? /^\s*[-*]\s+(.+?)\s*$/.exec(l) : null;
    if (v) vinetas.push(v[1]);
  }
  return vinetas;
}

/** Resumen automático del cliente: próxima reunión, entregables abiertos, lo que nos debe, aprendizajes y línea de tiempo. */
export function resumen(i: Indice, cliente: string, hoy: string, cuerpos: Cuerpos = {}): {
  proxima?: Reunion; abiertos: Entregable[]; debe: Promesa[]; aprendimos: string[]; linea: string[];
} {
  const proxima = i.reuniones
    .filter((r) => r.cliente === cliente && r.tipo === "brief-reunion" && diaDe(r.fecha) >= hoy)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0];
  const eventos = sinComentarios(cuerpos.linea ?? "").split(/\r?\n/).map((l) => l.trim().replace(/^[-*]\s+/, "")).filter((l) => l && !l.startsWith("#"));
  return {
    proxima,
    abiertos: i.entregables
      .filter((e) => e.cliente === cliente && !CERRADOS.has(e.estado))
      .sort((a, b) => String(a.vence).localeCompare(String(b.vence))),
    debe: (cuerpos.promesas ?? []).filter((p) => p.delCliente && !p.hecha && clienteDeRuta(p.acta) === cliente),
    aprendimos: aprendimosDe(cuerpos.contexto ?? ""),
    linea: eventos.slice(-MAX_LINEA).reverse(),
  };
}

/** `[[clientes/acme/entregables/2026-01-20-carrusel]]` → "Carrusel" (o el alias después de `|`). */
export const sinWikilinks = (t: string): string =>
  t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, ruta: string, alias?: string) => alias ?? titulo(ruta));

/** "YYYY-MM-DD · tipo · detalle · persona" → partes legibles. Una línea con otro formato queda como texto. */
export function evento(linea: string): { fecha: string | null; texto: string; quien: string | null } {
  const m = /^(\d{4}-\d{2}-\d{2})\s*·\s*([^·]+?)\s*·\s*(.+?)\s*·\s*([^·]+?)$/.exec(linea);
  if (!m) return { fecha: null, texto: sinWikilinks(linea), quien: null };
  const tipo = m[2].replace(/_/g, " ");
  return { fecha: m[1], texto: `${tipo[0].toUpperCase()}${tipo.slice(1)}: ${sinWikilinks(m[3])}`, quien: m[4] };
}

/** "Campaña de Navidad" → "campana-de-navidad". */
export const slugDe = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
