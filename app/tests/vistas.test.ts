import { expect, it } from "vitest";
import { POR_DEFECTO, parsearVistas } from "../ui/datos/vistas";

it("vistas.json ausente → las 4 por defecto", () => {
  expect(parsearVistas(null).map((v) => v.nombre)).toEqual(["Esta semana", "Todo", "Atrasado", "Esperando al cliente"]);
});

it("vistas.json con vistas → esas", () => {
  const v = [{ nombre: "Mías", filtro: { personas: ["cami"] }, agrupar: "estado" }];
  expect(parsearVistas(JSON.stringify(v))).toEqual(v);
});

it("vistas.json ilegible → las por defecto", () => {
  expect(parsearVistas("{no")).toEqual(POR_DEFECTO);
});
