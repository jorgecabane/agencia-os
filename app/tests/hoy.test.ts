import { describe, expect, it } from "vitest";
import { hoy } from "../ui/datos/hoy";
import { construirIndice } from "../ui/datos/indice";
import type { Promesa } from "../ui/datos/tipos";

const ficha = (slug: string, responsable: string) =>
  `---\ntipo: cliente\nnombre: ${slug}\nslug: ${slug}\netapa: activo\nmodalidad: retainer\nresponsable: ${responsable}\n---\n`;
const ent = (vence: string, estado = "brief", responsable = "cami", extra = "") =>
  `---\ntipo: entregable\ncliente: acme\nformato: post\nvence: ${vence}\nestado: ${estado}\nresponsable: ${responsable}\n${extra}---\n`;
const reu = (fecha: string, asistentes: string) =>
  `---\ntipo: brief-reunion\ncliente: acme\nfecha: ${fecha}\nasistentes: [${asistentes}]\n---\n`;

const E = "clientes/acme/entregables/";
const R = "clientes/acme/reuniones/";
const i = construirIndice(new Map([
  ["clientes/acme/_ficha.md", ficha("acme", "cami")],
  ["clientes/beta/_ficha.md", ficha("beta", "jorge")],
  [`${E}a-hoy.md`, ent("2026-10-27")],
  [`${E}b-atrasado.md`, ent("2026-10-20")],
  [`${E}c-futuro.md`, ent("2026-11-05")],
  [`${E}d-de-otro.md`, ent("2026-10-27", "brief", "jorge")],
  [`${E}e-publicado.md`, ent("2026-10-21", "publicado")],
  [`${E}f-cancelado.md`, ent("2026-10-21", "cancelado")],
  [`${E}g-tentativa.md`, ent("2026-10-29", "brief", "cami", "fecha_tentativa: true\n")],
  [`${R}hoy.md`, reu("2026-10-27T17:00-03:00", "cami, jorge")],
  [`${R}hoy-sin-mi.md`, reu("2026-10-27T10:00-03:00", "jorge")],
  [`${R}ayer.md`, reu("2026-10-26T17:00-03:00", "cami")],
]));

const promesa = (acta: string, extra: Partial<Promesa> = {}): Promesa => ({
  quien: "ana", que: "fotos", fecha: "2026-10-23", hecha: false, delCliente: true, acta, ...extra,
});

describe("hoy", () => {
  const h = hoy(i, "cami", "2026-10-27", [
    promesa("clientes/acme/reuniones/acta.md"),
    promesa("clientes/beta/reuniones/acta.md"),
    promesa("clientes/acme/reuniones/acta.md", { hecha: true }),
    promesa("clientes/acme/reuniones/acta.md", { delCliente: false, quien: "cami" }),
  ]);

  it("entregas: solo mías, abiertas, vence ≤ hoy, atrasadas primero", () => {
    expect(h.entregas.map((e) => e.ruta)).toEqual([`${E}b-atrasado.md`, `${E}a-hoy.md`]);
  });
  it("tentativas aparte", () => {
    expect(h.tentativas.map((e) => e.ruta)).toEqual([`${E}g-tentativa.md`]);
  });
  it("reuniones de hoy donde asisto", () => {
    expect(h.reuniones.map((r) => r.ruta)).toEqual([`${R}hoy.md`]);
  });
  it("lo que debe el cliente: abiertas, del cliente, solo donde soy responsable", () => {
    expect(h.debeCliente).toEqual([promesa("clientes/acme/reuniones/acta.md")]);
  });
});
