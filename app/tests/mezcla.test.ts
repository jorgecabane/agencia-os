import { describe, expect, it } from "vitest";
import { aGuardar, mezclar } from "../ui/datos/mezcla";

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
