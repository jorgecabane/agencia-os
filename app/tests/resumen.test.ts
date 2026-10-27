import { describe, expect, it } from "vitest";
import { construirIndice } from "../ui/datos/indice";
import { evento, resumen, slugDe } from "../ui/datos/resumen";
import type { Promesa } from "../ui/datos/tipos";

const ent = (cliente: string, vence: string, estado = "brief") =>
  `---\ntipo: entregable\ncliente: ${cliente}\nformato: post\nvence: ${vence}\nestado: ${estado}\nresponsable: cami\n---\n`;
const reu = (tipo: string, fecha: string) => `---\ntipo: ${tipo}\ncliente: acme\nfecha: ${fecha}\n---\n`;
const E = "clientes/acme/entregables/";
const R = "clientes/acme/reuniones/";

const i = construirIndice(new Map([
  [`${E}a.md`, ent("acme", "2026-11-05")],
  [`${E}b.md`, ent("acme", "2026-10-20", "revision")],
  [`${E}c.md`, ent("acme", "2026-10-21", "publicado")],
  [`${E}d.md`, ent("acme", "2026-10-22", "cancelado")],
  [`${E}e.md`, ent("acme", "2026-10-30", "en_curso")],
  ["clientes/beta/entregables/x.md", ent("beta", "2026-10-01")],
  [`${R}pasado.md`, reu("brief-reunion", "2026-10-20T10:00-03:00")],
  [`${R}lejano.md`, reu("brief-reunion", "2026-11-10T10:00-03:00")],
  [`${R}cercano.md`, reu("brief-reunion", "2026-10-29T17:00-03:00")],
  [`${R}acta-futura.md`, reu("reunion", "2026-10-28T10:00-03:00")],
]));

const contexto = `# Contexto

## Negocio
- no cuenta

## Lo que aprendimos
<!-- Una viñeta por aprendizaje:
- YYYY-MM-DD: <aprendizaje> -->
- 2026-10-14: los reels con perros convierten el doble
* 2026-10-21: prefieren poco texto

## Otra
- tampoco
`;
const eventos = Array.from({ length: 12 }, (_, k) => `2026-10-${String(k + 10)} · estado · evento ${k + 1} · ia`);
const linea = `# Línea de tiempo\n\n<!-- Append-only:\nYYYY-MM-DD · <tipo> -->\n${eventos.join("\n")}\n`;
const promesa = (extra: Partial<Promesa>): Promesa => ({
  quien: "ana", que: "fotos", fecha: null, hecha: false, delCliente: true, acta: `${R}acta.md`, ...extra,
});

describe("resumen de acme", () => {
  const r = resumen(i, "acme", "2026-10-27", {
    contexto, linea,
    promesas: [promesa({}), promesa({ hecha: true }), promesa({ delCliente: false }), promesa({ acta: "clientes/beta/reuniones/x.md" })],
  });

  it("próxima reunión = el brief futuro más cercano", () => {
    expect(r.proxima?.ruta).toBe(`${R}cercano.md`);
  });
  it("abiertos: sin publicados ni cancelados, solo del cliente, ordenados por vence", () => {
    expect(r.abiertos.map((e) => e.ruta)).toEqual([`${E}b.md`, `${E}e.md`, `${E}a.md`]);
  });
  it("debe: promesas abiertas del cliente en sus actas", () => {
    expect(r.debe).toEqual([promesa({})]);
  });
  it("aprendimos: viñetas de la sección, sin comentarios", () => {
    expect(r.aprendimos).toEqual(["2026-10-14: los reels con perros convierten el doble", "2026-10-21: prefieren poco texto"]);
  });
  it("línea de tiempo invertida y cortada en 10, sin título ni comentarios", () => {
    expect(r.linea).toHaveLength(10);
    expect(r.linea[0]).toBe(eventos[11]);
    expect(r.linea[9]).toBe(eventos[2]);
  });
  it("sin cuerpos: listas vacías", () => {
    const v = resumen(i, "acme", "2026-10-27");
    expect([v.debe, v.aprendimos, v.linea]).toEqual([[], [], []]);
  });
});

it("evento: separa fecha, texto (wikilinks como títulos) y quién", () => {
  expect(evento("2026-01-15 · reprogramado · [[clientes/acme/entregables/2026-01-20-carrusel-lanzamiento]] 17→20 · ia"))
    .toEqual({ fecha: "2026-01-15", texto: "Reprogramado: Carrusel lanzamiento 17→20", quien: "ia" });
  expect(evento("texto libre")).toEqual({ fecha: null, texto: "texto libre", quien: null });
});

it("slugDe: minúsculas, sin tildes, con guiones", () => {
  expect(slugDe("  Campaña de Navidad ¡2026! ")).toBe("campana-de-navidad-2026");
});
