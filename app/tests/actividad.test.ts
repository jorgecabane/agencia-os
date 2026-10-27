import { expect, it } from "vitest";
import type { Commit } from "../shared/puente";
import { actividad } from "../ui/datos/actividad";

const hoy = new Date("2026-10-27T15:00:00-03:00");
const c = (fecha: string, autor = "cami"): Commit => ({ hash: "a", autor, email: "c@a.cl", fecha, mensaje: "m", rutas: [] });

it("sin commits hace 4 días → quieta", () => {
  expect(actividad(c("2026-10-23T14:00:00-03:00"), hoy)).toEqual({ tipo: "quieta", texto: "Quieta hace 4 días" });
});

it("commit reciente → avanzó, con el nombre de la persona si calza", () => {
  const p = [{ ruta: "x", nombre: "Cami", slug: "cami", rol: "r", nivel_automatizacion: "alto" }];
  expect(actividad(c("2026-10-27T13:00:00-03:00"), hoy, p)).toEqual({ tipo: "avanzo", texto: "Cami avanzó hace 2 h" });
});

it("sin commit → sin abrir", () => {
  expect(actividad(undefined, hoy).tipo).toBe("sin-abrir");
});
