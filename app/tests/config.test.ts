import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { guardarConfig, leerConfig } from "../shell/config";
import { fixtureRepo } from "./helpers";

test("config por defecto y guardado parcial", () => {
  const ruta = join(fixtureRepo({}), "sub", "config.json");
  expect(leerConfig(ruta)).toEqual({
    repo: null,
    ultimoVisto: null,
    sesiones: {},
    avisos: { reuniones: true, actas: true, dia: true },
  });

  guardarConfig({ ultimoVisto: "abc123", avisos: { reuniones: false, actas: true, dia: true } }, ruta);
  guardarConfig({ repo: "/tmp/agencia" }, ruta);

  expect(leerConfig(ruta)).toEqual({
    repo: "/tmp/agencia",
    ultimoVisto: "abc123",
    sesiones: {},
    avisos: { reuniones: false, actas: true, dia: true },
  });
  expect(JSON.parse(readFileSync(ruta, "utf8")).repo).toBe("/tmp/agencia");
});
