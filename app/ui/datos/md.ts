import { parse, parseDocument, stringify } from "yaml";

export type Separado = {
  fm: string | null;
  meta: Record<string, unknown> | null;
  cuerpo: string;
  error?: string;
};

const CIERRE = /^---[ \t]*$/m;

/** Parte un .md en frontmatter (texto crudo y objeto) y cuerpo. Nunca lanza. */
export function separar(texto: string): Separado {
  const t = texto.replace(/^﻿/, "");
  if (!/^---[ \t]*\r?\n/.test(t)) return { fm: null, meta: null, cuerpo: t };
  const resto = t.slice(t.indexOf("\n") + 1);
  const cierre = CIERRE.exec(resto);
  if (!cierre) return { fm: null, meta: null, cuerpo: t, error: "frontmatter sin cerrar (falta ---)" };
  const fm = resto.slice(0, cierre.index).replace(/\r?\n$/, "");
  const cuerpo = resto.slice(cierre.index + cierre[0].length).replace(/^\r?\n/, "");
  try {
    const meta = parse(fm) ?? {};
    if (typeof meta !== "object" || Array.isArray(meta)) {
      return { fm, meta: null, cuerpo, error: "el frontmatter debe ser un mapa" };
    }
    return { fm, meta: meta as Record<string, unknown>, cuerpo };
  } catch (e) {
    return { fm, meta: null, cuerpo, error: `YAML inválido: ${(e as Error).message}` };
  }
}

/** Aplica `cambios` al frontmatter original tocando solo esas claves (conserva orden y comentarios). */
export function unir(fmOriginal: string | null, cambios: Record<string, unknown>, cuerpo: string): string {
  const doc = parseDocument(fmOriginal ?? stringify({}));
  for (const [clave, valor] of Object.entries(cambios)) doc.set(clave, valor);
  const fm = Object.keys(cambios).length === 0 && fmOriginal === null ? "" : doc.toString();
  return fm === "" ? cuerpo : `---\n${fm.replace(/\n?$/, "\n")}---\n${cuerpo}`;
}
