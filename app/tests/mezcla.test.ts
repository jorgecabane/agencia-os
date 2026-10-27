import { describe, expect, it } from "vitest";
import { serializar } from "../ui/datos/markdown";
import { separar } from "../ui/datos/md";
import { aGuardar, mezclar, pendiente } from "../ui/datos/mezcla";

const BASE = "# T\n\nPrimer párrafo.\n\nSegundo párrafo.\n\nTercero.\n";

describe("mezclar", () => {
  it("une cambios en párrafos distintos sin conflicto", () => {
    const mio = BASE.replace("Primer párrafo.", "Primer párrafo editado.");
    const afuera = BASE.replace("Tercero.", "Tercero de Claude.");
    expect(mezclar(BASE, mio, afuera)).toEqual({ texto: "# T\n\nPrimer párrafo editado.\n\nSegundo párrafo.\n\nTercero de Claude.\n", conflicto: false });
  });

  it("en el mismo párrafo marca conflicto y deja ambas versiones, la mía primero", () => {
    const mio = BASE.replace("Segundo párrafo.", "Segundo, versión mía.");
    const afuera = BASE.replace("Segundo párrafo.", "Segundo, versión de afuera.");
    const { texto, conflicto } = mezclar(BASE, mio, afuera);
    expect(conflicto).toBe(true);
    expect(texto).toContain("Segundo, versión mía.");
    expect(texto).toContain("Segundo, versión de afuera.");
    expect(texto.indexOf("versión mía")).toBeLessThan(texto.indexOf("versión de afuera"));
    expect(texto).toContain("Primer párrafo.");
    expect(texto).toContain("Tercero.");
  });

  it("si ambos hicieron el mismo cambio no hay conflicto", () => {
    const igual = BASE.replace("Tercero.", "Tercero!");
    expect(mezclar(BASE, igual, igual)).toEqual({ texto: igual, conflicto: false });
  });
});

describe("aGuardar", () => {
  it("abrir sin editar no escribe", () => {
    expect(aGuardar(BASE, BASE, BASE)).toEqual({ texto: null, conflicto: false });
    expect(aGuardar(BASE, BASE, "otra cosa\n")).toEqual({ texto: null, conflicto: false });
  });

  it("sin cambios de afuera escribe lo mío; con cambios de afuera, mezcla", () => {
    const mio = BASE.replace("Tercero.", "3.");
    expect(aGuardar(BASE, mio, BASE)).toEqual({ texto: mio, conflicto: false });
    const afuera = BASE.replace("# T", "# Título");
    expect(aGuardar(BASE, mio, afuera).texto).toBe("# Título\n\nPrimer párrafo.\n\nSegundo párrafo.\n\n3.\n");
  });
});

describe("mezclar con frontmatter", () => {
  const FM = (estado: string, extra = "") => `---\ntipo: entregable\nestado: ${estado}  # ojo\n${extra}---\n`;
  const CUERPO = "Intro.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nCierre.\n";

  it("si ambos cambian la misma clave queda YAML válido y gana la mía; el resto de afuera se conserva", () => {
    const base = FM("brief") + CUERPO;
    const mio = FM("en_curso") + CUERPO;
    const afuera = FM("revision", "responsable: cami\n") + CUERPO;
    const { texto, conflicto } = mezclar(base, mio, afuera);
    expect(conflicto).toBe(false);
    const s = separar(texto);
    expect(s.error).toBeUndefined();
    expect(s.meta).toEqual({ tipo: "entregable", estado: "en_curso", responsable: "cami" });
    expect(texto.match(/estado:/g)).toHaveLength(1);
    expect(s.cuerpo).toBe(CUERPO);
  });

  it("la normalización de mi primera edición no choca con una tabla editada afuera", () => {
    const base = FM("brief") + CUERPO;
    const mio = FM("brief") + serializar(CUERPO.replace("Intro.", "Intro editada."));
    const afuera = FM("brief") + CUERPO.replace("| 1 | 2 |", "| 1 | 22 |");
    const { texto, conflicto } = mezclar(base, mio, afuera);
    expect(conflicto).toBe(false);
    expect(texto).toContain("Intro editada.");
    expect(texto).toMatch(/\| 1 +\| 22 +\|/);
  });
});

describe("pendiente", () => {
  it("hay algo sin guardar si el lienzo difiere de lo ya incorporado (aunque su aviso no haya llegado) o hay etiquetas cambiadas", () => {
    expect(pendiente("a", "a", {})).toBe(false);
    expect(pendiente("a", "ab", {})).toBe(true);
    expect(pendiente("a", null, {})).toBe(false); // lienzo aún no creado
    expect(pendiente("a", "a", { estado: "x" })).toBe(true);
  });
});
