import { diff3Merge } from "node-diff3";
import { serializar } from "./markdown";
import { separar, unir } from "./md";

export type Mezcla = { texto: string; conflicto: boolean };

/** Mezcla de tres vías por líneas. Si chocan, quedan ambas versiones del bloque (la mía primero), separadas por una línea en blanco. */
function porLineas(base: string, mio: string, afuera: string): Mezcla {
  const lineas = (t: string) => t.split("\n");
  let conflicto = false;
  const out = diff3Merge(lineas(mio), lineas(base), lineas(afuera)).flatMap((r) => {
    if (r.ok) return r.ok;
    conflicto = true;
    return [...r.conflict!.a, "", ...r.conflict!.b];
  });
  return { texto: out.join("\n"), conflicto };
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Mezcla de tres vías de un .md. El frontmatter nunca pasa por diff3: sobre el de afuera se aplican las
 * claves que yo cambié (gana la mía). El cuerpo se mezcla por líneas, ya serializado los tres, para que la
 * normalización de mi primera edición no invente choques. Con frontmatter roto, se mezcla el archivo entero.
 */
export function mezclar(base: string, mio: string, afuera: string): Mezcla {
  const [b, m, a] = [separar(base), separar(mio), separar(afuera)];
  if (b.error || m.error || a.error) return porLineas(base, mio, afuera);
  const cambios = Object.fromEntries(Object.entries(m.meta ?? {}).filter(([k, v]) => !igual(v, b.meta?.[k])));
  const cuerpo =
    m.cuerpo === b.cuerpo ? { texto: a.cuerpo, conflicto: false }
    : a.cuerpo === b.cuerpo ? { texto: m.cuerpo, conflicto: false }
    : porLineas(serializar(b.cuerpo), serializar(m.cuerpo), serializar(a.cuerpo));
  return { texto: unir(a.fm, cambios, cuerpo.texto), conflicto: cuerpo.conflicto };
}

/**
 * Qué escribir al guardar: nada si no cambié nada respecto de lo cargado (`base`); lo mío si el disco
 * sigue igual a `base`; si no, la mezcla con lo que hay en disco.
 */
export function aGuardar(base: string, mio: string, enDisco: string): { texto: string | null; conflicto: boolean } {
  if (mio === base) return { texto: null, conflicto: false };
  if (enDisco === base) return { texto: mio, conflicto: false };
  return mezclar(base, mio, enDisco);
}

/**
 * Hay algo sin guardar: etiquetas cambiadas, o el contenido actual del editor (`actual`, leído en vivo; null si
 * aún no existe) difiere de lo ya incorporado a la base (`visto`). Se lee en vivo porque el aviso de cambio del
 * editor llega con ~200 ms de atraso: recargar antes perdería lo recién tecleado.
 */
export const pendiente = (visto: string | null, actual: string | null, cambios: Record<string, unknown>): boolean =>
  Object.keys(cambios).length > 0 || (actual !== null && actual !== visto);
