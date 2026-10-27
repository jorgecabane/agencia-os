import { describe, expect, it } from "vitest";
import { debeAvisar, esHttps, recordar } from "../shell/avisos";

const config = { avisos: { reuniones: true, actas: true, dia: true }, pausaHasta: null, yaAvisados: [] as string[] };
const ahora = new Date("2026-10-27T19:52:00Z");

describe("esHttps", () => {
  it("solo acepta https", () => {
    expect(esHttps("https://meet.google.com/abc")).toBe(true);
    expect(esHttps("http://meet.google.com/abc")).toBe(false);
    expect(esHttps("javascript:alert(1)")).toBe(false);
    expect(esHttps("file:///etc/passwd")).toBe(false);
    expect(esHttps("no es un link")).toBe(false);
    expect(esHttps(42)).toBe(false);
  });
});

describe("debeAvisar", () => {
  it("respeta lo ya avisado, cada interruptor y la pausa", () => {
    expect(debeAvisar(config, "reunion:x.md", ahora)).toBe(true);
    expect(debeAvisar({ ...config, yaAvisados: ["reunion:x.md"] }, "reunion:x.md", ahora)).toBe(false);
    expect(debeAvisar({ ...config, avisos: { ...config.avisos, actas: false } }, "acta:x.md", ahora)).toBe(false);
    expect(debeAvisar({ ...config, avisos: { ...config.avisos, dia: false } }, "dia:2026-10-27", ahora)).toBe(false);
    expect(debeAvisar({ ...config, pausaHasta: "2026-10-27T20:30:00Z" }, "reunion:x.md", ahora)).toBe(false);
    expect(debeAvisar({ ...config, pausaHasta: "2026-10-27T19:00:00Z" }, "reunion:x.md", ahora)).toBe(true);
    expect(debeAvisar(config, "otro:x", ahora)).toBe(false);
  });
});

describe("recordar", () => {
  it("agrega sin duplicar y guarda solo los últimos", () => {
    expect(recordar(["a", "b"], "a")).toEqual(["b", "a"]);
    expect(recordar(Array.from({ length: 500 }, (_, k) => String(k)), "nuevo")).toHaveLength(500);
  });
});
