import { expect, it } from "vitest";
import { aplicar, conteos } from "../ui/datos/filtros";
import type { Entregable } from "../ui/datos/tipos";

const e = (ruta: string, cliente: string, responsable: string, vence: string, estado = "brief"): Entregable => ({
  ruta, cliente, responsable, vence, estado, formato: "post",
});
const es = [
  e("a", "donnas", "cami", "2026-10-29"),
  e("b", "donnas", "jorge", "2026-10-29"),
  e("c", "pilates", "cami", "2026-10-26"),
  e("d", "clima", "cami", "2026-10-28"),
  e("e", "donnas", "cami", "2026-11-20"),
  e("f", "donnas", "cami", "2026-10-28", "cancelado"),
];

it("combina persona + cliente + semana y nunca muestra canceladas", () => {
  const r = aplicar(es, { personas: ["cami"], clientes: ["donnas", "pilates"], vence: "semana" }, "2026-10-27");
  expect(r.map((x) => x.ruta)).toEqual(["a", "c"]);
});

it("atrasado: vence antes de hoy y sigue abierto", () => {
  const r = aplicar([...es, e("g", "donnas", "cami", "2026-10-01", "publicado")], { vence: "atrasado" }, "2026-10-27");
  expect(r.map((x) => x.ruta)).toEqual(["c"]);
});

it("conteos por cliente", () => {
  expect(conteos(aplicar(es, {}, "2026-10-27"), "cliente")).toEqual({ donnas: 3, pilates: 1, clima: 1 });
});
