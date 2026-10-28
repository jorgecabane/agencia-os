import { separar, unir } from "./md";
import { slugDe } from "./resumen";

export type Etiqueta = { slug: string; nombre: string; color: number };
export const CATALOGO = "equipo/etiquetas.md";
const COLORES = 6;

const valida = (e: unknown): e is Etiqueta => {
  const o = e as Record<string, unknown> | null;
  return typeof o?.slug === "string" && typeof o.nombre === "string"
    && Number.isInteger(o.color) && (o.color as number) >= 1 && (o.color as number) <= COLORES;
};

/** Catálogo del frontmatter `etiquetas: [{slug, nombre, color}]`; si es inválido, `[]`. */
export function leerCatalogo(texto: string): Etiqueta[] {
  const lista = separar(texto).meta?.etiquetas;
  return Array.isArray(lista) && lista.every(valida) ? lista.map(({ slug, nombre, color }) => ({ slug, nombre, color })) : [];
}

/** Etiqueta para `nombre`: la existente con ese slug o una nueva con el color siguiente al más alto. */
export function nuevaEtiqueta(catalogo: Etiqueta[], nombre: string): Etiqueta {
  const slug = slugDe(nombre);
  const existente = catalogo.find((e) => e.slug === slug);
  if (existente) return existente;
  const ultimo = Math.max(0, ...catalogo.map((e) => e.color));
  return { slug, nombre: nombre.trim(), color: (ultimo % COLORES) + 1 };
}

/** Relee el catálogo y suma (o reemplaza) la etiqueta. Crea el archivo si no existe. */
export async function guardarEtiqueta(e: Etiqueta): Promise<void> {
  const texto = await window.aos.repo.read(CATALOGO).catch(() => "");
  const actual = separar(texto);
  if (actual.error) throw new Error(actual.error);
  const catalogo = leerCatalogo(texto);
  const etiquetas = [...catalogo.filter((x) => x.slug !== e.slug), e];
  await window.aos.repo.write(CATALOGO, unir(actual.fm, { etiquetas }, actual.cuerpo));
}

export const colorEtiqueta = (e: Etiqueta): string => `var(--cliente-${e.color})`;
