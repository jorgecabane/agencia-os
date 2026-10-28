import { agregarEnSeccion, seccion } from "./md";
import type { Persona } from "./tipos";

export type Comentario = { fecha: string; autor: string; texto: string };

/** Comentarios de las líneas `- <fecha> · <autor>: <texto>` bajo `## Comentarios`. */
export function comentarios(cuerpo: string): Comentario[] {
  const lineas = cuerpo.split("\n");
  const [ini, fin] = seccion(lineas, "Comentarios") ?? [0, 0];
  return lineas.slice(ini, fin).flatMap((l) => {
    const m = /^-\s+(.+)$/.exec(l.trim());
    const sep = m?.[1].indexOf(" · ") ?? -1;
    if (!m || sep < 0) return [];
    const resto = m[1].slice(sep + 3);
    const dos = resto.indexOf(": ");
    return dos < 0 ? [] : [{ fecha: m[1].slice(0, sep), autor: resto.slice(0, dos), texto: resto.slice(dos + 2) }];
  });
}

export const agregarComentario = (cuerpo: string, c: Comentario): string =>
  agregarEnSeccion(cuerpo, "Comentarios", `- ${c.fecha} · ${c.autor}: ${c.texto.replace(/\s*\r?\n\s*/g, " ").trim()}`);

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Slugs de las personas mencionadas con `@PrimerNombre` o `@slug`. */
export function menciones(texto: string, personas: Persona[]): string[] {
  const hallados = new Set<string>();
  for (const [, palabra] of texto.matchAll(/@([\p{L}\d_-]+)/gu)) {
    const p = norm(palabra);
    const persona = personas.find((x) => x.slug === p || norm(x.nombre).split(/\s+/)[0] === p);
    if (persona) hallados.add(persona.slug);
  }
  return [...hallados];
}
