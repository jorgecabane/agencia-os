import { describe, expect, it } from "vitest";
import { leer } from "../ui/componentes/Etiquetas";

describe("leer una etiqueta editada", () => {
  it("sí/no conserva el tipo booleano y rechaza otra cosa", () => {
    expect(leer("sí", true)).toEqual({ valor: true });
    expect(leer("No", true)).toEqual({ valor: false });
    expect(leer("true", false)).toEqual({ valor: true });
    expect(leer("false", true)).toEqual({ valor: false });
    expect(leer("quizás", true)).toEqual({ error: "Escribe sí o no" });
  });
  it("números, listas y texto", () => {
    expect(leer("3", 1)).toEqual({ valor: 3 });
    expect(leer("tres", 1)).toEqual({ error: "Escribe un número" });
    expect(leer("a, b,", ["x"])).toEqual({ valor: ["a", "b"] });
    expect(leer("hola", "x")).toEqual({ valor: "hola" });
  });
});
