import { agregarEnSeccion, seccion } from "./md";

export type Casilla = { texto: string; hecho: boolean; linea: number };
const CASILLA = /^(\s*-\s+\[)([ xX])(\]\s+)(.*)$/;

/** Casillas `- [ ] texto` bajo `## Checklist`; `linea` es el índice en el cuerpo. */
export function checklist(cuerpo: string): Casilla[] {
  const lineas = cuerpo.split("\n");
  const [ini, fin] = seccion(lineas, "Checklist") ?? [0, 0];
  return lineas.flatMap((l, linea) => {
    const m = linea >= ini && linea < fin ? CASILLA.exec(l) : null;
    return m ? [{ texto: m[4], hecho: m[2] !== " ", linea }] : [];
  });
}

/** Alterna la casilla de esa línea, solo si está dentro de `## Checklist`. */
export function alternarCasilla(cuerpo: string, linea: number): string {
  const lineas = cuerpo.split("\n");
  const [ini, fin] = seccion(lineas, "Checklist") ?? [0, 0];
  const m = linea >= ini && linea < fin ? CASILLA.exec(lineas[linea] ?? "") : null;
  if (m) lineas[linea] = `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}${m[4]}`;
  return lineas.join("\n");
}

export const agregarCasilla = (cuerpo: string, texto: string): string =>
  agregarEnSeccion(cuerpo, "Checklist", `- [ ] ${texto.trim()}`);
