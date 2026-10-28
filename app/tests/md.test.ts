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

  it("no toca claves intactas: valor largo, lista en flujo y CRLF", () => {
    const largo = "x ".repeat(80).trim();
    const fm = `tipo: cliente\r\nnota: ${largo}\r\nemails: [a,   b]\r\nvence: 2026-10-01`;
    const salida = unir(fm, { vence: "2026-10-30" }, "c\n");
    expect(salida).toBe(`---\r\n${fm.replace("10-01", "10-30")}\r\n---\r\nc\n`);
  });

  it("unir con undefined borra la clave (y si no está, no hace nada)", () => {
    const { fm, cuerpo } = separar(ARCHIVO.replace("estado: brief", "fecha_tentativa: true\nestado: brief"));
    expect(unir(fm, { vence: "2026-10-30", fecha_tentativa: undefined }, cuerpo)).toBe(ARCHIVO.replace("2026-10-01", "2026-10-30"));
    const ultima = separar(ARCHIVO.replace("estado: brief", "estado: brief\nfecha_tentativa: true"));
    expect(unir(ultima.fm, { fecha_tentativa: undefined }, ultima.cuerpo)).toBe(ARCHIVO);
    expect(unir(separar(ARCHIVO).fm, { fecha_tentativa: undefined }, separar(ARCHIVO).cuerpo)).toBe(ARCHIVO);
  });

  it("unir sin frontmatter previo escribe mapa en bloque", () => {
    expect(unir(null, { x: 1 }, "c\n")).toBe("---\nx: 1\n---\nc\n");
  });
});
