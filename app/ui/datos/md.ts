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
    const borrar = valor === undefined; // undefined = quitar la clave
    const txt = borrar ? "" : lf(texto({ [clave]: valor }));
    const par = isMap(mapa) ? mapa.items.find((p) => isScalar(p.key) && p.key.value === clave) : undefined;
    const k = par && isScalar(par.key) ? par.key.range : null;
    if (!par || !k) { if (!borrar) nuevas.push(txt); continue; }
    const v = isNode(par.value) ? par.value.range : null;
    let fin = v ? v[1] : fm.indexOf(":", k[1]) + 1;
    while (v && /\s/.test(fm[fin - 1] ?? "")) fin--;
    let ini = k[0];
    // Al borrar se va la línea entera: su salto, o el anterior si es la última.
    if (borrar && fm.startsWith(eol, fin)) fin += eol.length;
    else if (borrar && ini >= eol.length) ini -= eol.length;
    ediciones.push({ ini, fin, txt });
  }
  for (const { ini, fin, txt } of ediciones.sort((a, b) => b.ini - a.ini)) fm = fm.slice(0, ini) + txt + fm.slice(fin);
  fm = [fm, ...nuevas].filter((x) => x !== "").join(eol);
  return fm === "" ? cuerpo : `---${eol}${fm}${eol}---${eol}${cuerpo}`;
}

/** Relee `ruta` justo antes de escribir (para no pisar cambios recientes) y cambia solo esas claves. */
export async function cambiar(ruta: string, cambios: Record<string, unknown>): Promise<void> {
  const actual = separar(await window.aos.repo.read(ruta));
  if (actual.error) throw new Error(actual.error);
  await window.aos.repo.write(ruta, unir(actual.fm, cambios, actual.cuerpo));
}

/** Relee `ruta` justo antes de escribir y cambia solo el cuerpo con `f`; el frontmatter queda byte a byte. */
export async function cambiarCuerpo(ruta: string, f: (cuerpo: string) => string): Promise<void> {
  const actual = separar(await window.aos.repo.read(ruta));
  if (actual.error) throw new Error(actual.error);
  await window.aos.repo.write(ruta, unir(actual.fm, {}, f(actual.cuerpo)));
}

/** Rango [ini, fin) de las líneas bajo `## <nombre>`, o null si la sección no existe. */
export function seccion(lineas: string[], nombre: string): [number, number] | null {
  const ini = lineas.findIndex((l) => new RegExp(`^##\\s+${nombre}\\s*$`, "i").test(l));
  if (ini < 0) return null;
  const sig = lineas.findIndex((l, k) => k > ini && /^##\s/.test(l));
  return [ini + 1, sig < 0 ? lineas.length : sig];
}

/** Agrega `linea` al final de la sección `## <nombre>` (la crea al final del cuerpo si no existe). */
export function agregarEnSeccion(cuerpo: string, nombre: string, linea: string): string {
  const lineas = cuerpo.split("\n");
  const rango = seccion(lineas, nombre);
  if (!rango) return `${cuerpo.trimEnd()}\n\n## ${nombre}\n\n${linea}${cuerpo.endsWith("\n") ? "\n" : ""}`;
  let fin = rango[1];
  while (fin > rango[0] && lineas[fin - 1].trim() === "") fin--;
  lineas.splice(fin, 0, ...(fin === rango[0] ? ["", linea] : [linea]));
  return lineas.join("\n");
}
