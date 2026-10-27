import type { Promesa, Reunion } from "./tipos";

const CASILLA = /^\s*[-*] \[([ xX])\]\s*(.*?)\s*$/;
const DETALLE = /^([^:]+):\s*(.+?)(?:\s*\((\d{4}-\d{2}-\d{2}|sin fecha)\))?$/;

/**
 * Lee las casillas `- [ ] quien: qué (YYYY-MM-DD|sin fecha)` bajo `## Promesas` del acta.
 * Fecha ausente o ilegible -> `fecha: null` (el texto crudo queda en `que`).
 * Las casillas sin `quien:` no se pueden leer y vuelven en `ignoradas`.
 */
export function promesasDeActa(
  acta: Reunion, cuerpo: string, slugsEquipo: Set<string>,
): { promesas: Promesa[]; ignoradas: string[] } {
  const equipo = new Set([...slugsEquipo].map((s) => s.toLowerCase()));
  const promesas: Promesa[] = [];
  const ignoradas: string[] = [];
  let dentro = false;
  for (const linea of cuerpo.split(/\r?\n/)) {
    if (/^##\s/.test(linea)) dentro = /^##\s+Promesas\s*$/.test(linea);
    const c = dentro ? CASILLA.exec(linea) : null;
    if (!c) continue;
    const m = DETALLE.exec(c[2]);
    if (!m) { ignoradas.push(linea); continue; }
    const quien = m[1].trim();
    promesas.push({
      quien, que: m[2].trim(), fecha: m[3] && m[3] !== "sin fecha" ? m[3] : null,
      hecha: c[1] !== " ", delCliente: !equipo.has(quien.toLowerCase()), acta: acta.ruta,
    });
  }
  return { promesas, ignoradas };
}
