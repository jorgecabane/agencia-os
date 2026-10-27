import { diff3Merge } from "node-diff3";

export type Mezcla = { texto: string; conflicto: boolean };

/** Mezcla de tres vías por líneas. Si chocan, quedan ambas versiones del bloque (la mía primero), separadas por una línea en blanco. */
export function mezclar(base: string, mio: string, afuera: string): Mezcla {
  const lineas = (t: string) => t.split("\n");
  let conflicto = false;
  const out = diff3Merge(lineas(mio), lineas(base), lineas(afuera)).flatMap((r) => {
    if (r.ok) return r.ok;
    conflicto = true;
    return [...r.conflict!.a, "", ...r.conflict!.b];
  });
  return { texto: out.join("\n"), conflicto };
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
