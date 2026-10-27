import { Document, isMap, isNode, isScalar, parse, parseDocument } from "yaml";

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

/** Aplica `cambios` al frontmatter original reemplazando solo el texto de esas claves; el resto queda byte a byte. */
export function unir(fmOriginal: string | null, cambios: Record<string, unknown>, cuerpo: string): string {
  const texto = (obj: unknown) => new Document(obj).toString({ lineWidth: 0 }).trimEnd();
  const eol = fmOriginal?.includes("\r\n") ? "\r\n" : "\n";
  const lf = (t: string) => t.replace(/\n/g, eol);
  let fm = fmOriginal ?? "";
  const nuevas: string[] = [];
  const ediciones: { ini: number; fin: number; txt: string }[] = [];
  const mapa = fmOriginal === null ? null : parseDocument(fmOriginal).contents;
  for (const [clave, valor] of Object.entries(cambios)) {
    const txt = lf(texto({ [clave]: valor }));
    const par = isMap(mapa) ? mapa.items.find((p) => isScalar(p.key) && p.key.value === clave) : undefined;
    const k = par && isScalar(par.key) ? par.key.range : null;
    if (!par || !k) { nuevas.push(txt); continue; }
    const v = isNode(par.value) ? par.value.range : null;
    let fin = v ? v[1] : fm.indexOf(":", k[1]) + 1;
    while (v && /\s/.test(fm[fin - 1] ?? "")) fin--;
    ediciones.push({ ini: k[0], fin, txt });
  }
  for (const { ini, fin, txt } of ediciones.sort((a, b) => b.ini - a.ini)) fm = fm.slice(0, ini) + txt + fm.slice(fin);
  fm = [fm, ...nuevas].filter((x) => x !== "").join(eol);
  return fm === "" ? cuerpo : `---${eol}${fm}${eol}---${eol}${cuerpo}`;
}
