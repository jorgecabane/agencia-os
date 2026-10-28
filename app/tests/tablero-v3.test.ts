import { describe, expect, it } from "vitest";
import { opcionesEtiqueta, type Etiqueta } from "../ui/datos/etiquetas";
import { alternar } from "../ui/datos/filtros";
import { teclaMenu } from "../ui/datos/menu";

describe("teclaMenu", () => {
  it("cada letra lleva a su opción, sin distinguir mayúsculas", () => {
    expect(teclaMenu("m")).toBe("mover");
    expect(teclaMenu("A")).toBe("asignar");
    expect(teclaMenu("r")).toBe("reagendar");
    expect(teclaMenu("L")).toBe("etiquetas");
    expect(teclaMenu("Backspace")).toBe("borrar");
  });
  it("otras teclas no hacen nada", () => {
    expect(teclaMenu("x")).toBeNull();
    expect(teclaMenu("Enter")).toBeNull();
    expect(teclaMenu("Delete")).toBeNull();
  });
});

describe("opcionesEtiqueta", () => {
  const catalogo: Etiqueta[] = [
    { slug: "adopcion", nombre: "Adopción", color: 4 },
    { slug: "campana-navidad", nombre: "Campaña Navidad", color: 5 },
    { slug: "navidad-2025", nombre: "Navidad 2025", color: 1 },
  ];
  it("sin texto: todas, sin crear", () => {
    expect(opcionesEtiqueta(catalogo, "  ")).toEqual({ lista: catalogo, crear: null });
  });
  it("filtra sin tildes ni mayúsculas y ofrece crear si nada calza exacto", () => {
    const r = opcionesEtiqueta(catalogo, "NAVI");
    expect(r.lista.map((e) => e.slug)).toEqual(["campana-navidad", "navidad-2025"]);
    expect(r.crear).toBe("NAVI");
  });
  it("no ofrece crear si un nombre normalizado es igual", () => {
    expect(opcionesEtiqueta(catalogo, " adopcion ")).toEqual({ lista: [catalogo[0]], crear: null });
    expect(opcionesEtiqueta(catalogo, "campana navidad").crear).toBeNull();
  });
});

it("alternar también suma y quita etiquetas del filtro", () => {
  const f = alternar({}, "etiquetas", "adopcion");
  expect(f.etiquetas).toEqual(["adopcion"]);
  expect(alternar(f, "etiquetas", "adopcion").etiquetas).toBeUndefined();
});
