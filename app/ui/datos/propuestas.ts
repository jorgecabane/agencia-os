const VINETA = /^\s*[-*]\s+(.+?)\s*$/;
const RECOMENDADA = /\s*\(recomendada\)$/i;

/** Viñetas bajo `## Propuestas`; la que termina en "(recomendada)" queda marcada. */
export function propuestas(cuerpo: string): { texto: string; recomendada: boolean }[] {
  const salida: { texto: string; recomendada: boolean }[] = [];
  let dentro = false;
  for (const linea of cuerpo.split(/\r?\n/)) {
    if (/^##\s/.test(linea)) dentro = /^##\s+Propuestas\s*$/i.test(linea);
    const m = dentro ? VINETA.exec(linea) : null;
    if (m) salida.push({ texto: m[1].replace(RECOMENDADA, ""), recomendada: RECOMENDADA.test(m[1]) });
  }
  return salida;
}

export type Inspiracion = { tipo: "imagen"; ruta: string } | { tipo: "link"; url: string };
const IMAGEN = /(?:clientes\/[^/\s]+\/)?adjuntos\/[^\s)\]|"']+\.(?:png|jpe?g|gif|webp|avif)/gi;
const URL = /https?:\/\/[^\s)\]>"']+/g;

/** Imágenes de `adjuntos/` y links que citan las propuestas (rutas de imagen relativas a la raíz del repo). */
export function inspiracion(textos: string[], cliente: string): Inspiracion[] {
  const vistos = new Set<string>();
  const salida: Inspiracion[] = [];
  for (const t of textos) {
    for (const m of t.match(IMAGEN) ?? []) {
      const ruta = m.startsWith("clientes/") ? m : `clientes/${cliente}/${m}`;
      if (!vistos.has(ruta)) salida.push({ tipo: "imagen", ruta }), vistos.add(ruta);
    }
    for (const url of t.match(URL) ?? []) if (!vistos.has(url)) salida.push({ tipo: "link", url }), vistos.add(url);
  }
  return salida;
}
