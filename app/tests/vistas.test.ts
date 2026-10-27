import { expect, it } from "vitest";
import { igual, parsearVistas } from "../ui/datos/vistas";

it("vistas.json ausente → las 4 por defecto", () => {
  expect(parsearVistas(null).map((v) => v.nombre)).toEqual(["Esta semana", "Todo", "Atrasado", "Esperando al cliente"]);
});

it("vistas.json con vistas → esas", () => {
  const v = [{ nombre: "Mías", filtro: { personas: ["cami"] }, agrupar: "estado" }];
  expect(parsearVistas(JSON.stringify(v))).toEqual(v);
});

it("vistas.json ilegible o sin vistas → error, nunca las por defecto (se pisarían al guardar)", () => {
  expect(() => parsearVistas("{no")).toThrow();
  expect(() => parsearVistas("[]")).toThrow();
  expect(() => parsearVistas('[{"nombre": 1}]')).toThrow();
});

it("igual no depende del orden de claves ni de valores", () => {
  const a = { filtro: { clientes: ["a", "b"], vence: "semana" as const }, agrupar: "estado" as const };
  const b = { filtro: { vence: "semana" as const, clientes: ["b", "a"] }, agrupar: "estado" as const };
  expect(igual(a, b)).toBe(true);
  expect(igual(a, { ...b, agrupar: "persona" })).toBe(false);
});
