import { describe, expect, it } from "vitest";
import { porMes, sinContacto } from "../ui/datos/contacto";
import type { Indice } from "../ui/datos/indice";
import type { Cliente, Reunion } from "../ui/datos/tipos";

const HOY = "2026-10-28";
const cli = (etapa = "activo", proximo_contacto?: string): Cliente => ({
  ruta: "clientes/acme/_ficha.md", nombre: "Acme", slug: "acme", etapa, modalidad: "retainer", responsable: "cami", proximo_contacto,
});
const reu = (fecha: string, tipo: Reunion["tipo"] = "reunion"): Reunion => ({ ruta: `clientes/acme/reuniones/${fecha}.md`, tipo, cliente: "acme", fecha });
const indice = (c: Cliente, reuniones: Reunion[]) => ({ clientes: [c], reuniones } as unknown as Indice);

describe("sinContacto", () => {
  it("última reunión hace 20 días, sin proximo_contacto: alerta", () => {
    expect(sinContacto(indice(cli(), [reu("2026-10-08"), reu("2026-09-01")]), "acme", HOY)).toEqual({ dias: 20, quedamos: null });
  });
  it("reunión hace 5 días: sin alerta (los briefs y las futuras no cuentan)", () => {
    expect(sinContacto(indice(cli(), [reu("2026-10-23")]), "acme", HOY)).toBeNull();
    expect(sinContacto(indice(cli(), [reu("2026-10-01"), reu("2026-10-25", "brief-reunion"), reu("2026-11-02")]), "acme", HOY))
      .toEqual({ dias: 27, quedamos: null });
  });
  it("proximo_contacto ayer: alerta con quedamos", () => {
    expect(sinContacto(indice(cli("activo", "2026-10-27"), [reu("2026-10-23")]), "acme", HOY)).toEqual({ dias: 5, quedamos: "2026-10-27" });
    expect(sinContacto(indice(cli("prospecto", "2026-10-27"), []), "acme", HOY)).toEqual({ dias: null, quedamos: "2026-10-27" });
  });
  it("un proximo_contacto por venir (Ya hablamos) calla el aviso por días", () => {
    expect(sinContacto(indice(cli("activo", "2026-11-11"), [reu("2026-10-08")]), "acme", HOY)).toBeNull();
  });
  it("etapa cerrado: sin alerta", () => {
    expect(sinContacto(indice(cli("cerrado", "2026-10-01"), [reu("2026-08-01")]), "acme", HOY)).toBeNull();
  });
});

describe("porMes", () => {
  it("agrupa por mes, lo más nuevo primero", () => {
    const g = porMes(["2026-09-29", "2026-10-24", "2026-10-13"], (x) => x, true);
    expect(g).toEqual([{ mes: "Octubre", items: ["2026-10-24", "2026-10-13"] }, { mes: "Septiembre", items: ["2026-09-29"] }]);
  });
  it("ascendente y con año si no es el actual", () => {
    const año = Number(new Date().getFullYear());
    const g = porMes([`${año + 1}-01-05`, `${año}-12-20`], (x) => x, false);
    expect(g.map((x) => x.mes)).toEqual(["Diciembre", `Enero ${año + 1}`]);
  });
});
