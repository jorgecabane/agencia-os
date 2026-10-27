import type { Promesa, Reunion } from "./tipos";

const LINEA = /^- \[([ xX])\] ([^:]+): (.+) \((\d{4}-\d{2}-\d{2}|sin fecha)\)\s*$/;

/** Lee las líneas `- [ ] quien: qué (fecha|sin fecha)` bajo `## Promesas` del acta. */
export function promesasDeActa(acta: Reunion, cuerpo: string, slugsEquipo: Set<string>): Promesa[] {
  const promesas: Promesa[] = [];
  let dentro = false;
  for (const linea of cuerpo.split(/\r?\n/)) {
    if (/^##\s/.test(linea)) dentro = /^##\s+Promesas\s*$/.test(linea);
    const m = dentro ? LINEA.exec(linea) : null;
    if (!m) continue;
    const quien = m[2].trim();
    promesas.push({
      quien, que: m[3].trim(), fecha: m[4] === "sin fecha" ? null : m[4],
      hecha: m[1] !== " ", delCliente: !slugsEquipo.has(quien), acta: acta.ruta,
    });
  }
  return promesas;
}
