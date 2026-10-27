import { describe, expect, it } from "vitest";
import { separar, unir } from "../ui/datos/md";

const ARCHIVO = "---\ntipo: entregable\n# x\nvence: 2026-10-01\nestado: brief\n---\ncuerpo\nmás\n";

describe("md", () => {
  it("separa frontmatter y cuerpo", () => {
    const s = separar(ARCHIVO);
    expect(s.meta).toMatchObject({ tipo: "entregable", estado: "brief" });
    expect(s.cuerpo).toBe("cuerpo\nmás\n");
    expect(s.error).toBeUndefined();
  });

  it("sin frontmatter devuelve todo como cuerpo", () => {
    expect(separar("hola\n")).toEqual({ fm: null, meta: null, cuerpo: "hola\n" });
  });

  it("frontmatter sin cerrar da error y no lanza", () => {
    expect(separar("---\ntipo: cliente\nnombre: A\n").error).toMatch(/sin cerrar/);
  });

  it("YAML inválido da error y no lanza", () => {
    expect(separar("---\na: [1\n---\nx").error).toMatch(/YAML/);
  });

  it("unir cambia solo la clave pedida y conserva comentarios", () => {
    const { fm, cuerpo } = separar(ARCHIVO);
    expect(unir(fm, { vence: "2026-10-30" }, cuerpo)).toBe(ARCHIVO.replace("2026-10-01", "2026-10-30"));
  });

  it("unir agrega claves nuevas al final", () => {
    const { fm, cuerpo } = separar(ARCHIVO);
    expect(unir(fm, { responsable: "jorge" }, cuerpo)).toContain("estado: brief\nresponsable: jorge\n---\n");
  });
});
