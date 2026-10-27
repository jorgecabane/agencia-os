import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { guardarConfig, leerConfig } from "../shell/config";
import { guardarPersona, personaGuardada } from "../shell/sync";
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

test("persona: null sin archivo; guardarla conserva el resto de settings.local.json", () => {
  const raiz = fixtureRepo({ ".claude/settings.local.json": JSON.stringify({ permissions: { allow: ["x"] }, env: { OTRA: "1" } }) });
  expect(personaGuardada(fixtureRepo({}))).toBeNull();
  expect(personaGuardada(raiz)).toBeNull();
  guardarPersona(raiz, "cami");
  expect(personaGuardada(raiz)).toBe("cami");
  expect(JSON.parse(readFileSync(join(raiz, ".claude/settings.local.json"), "utf8"))).toEqual({
    permissions: { allow: ["x"] }, env: { OTRA: "1", AOS_PERSONA: "cami" },
  });
  expect(() => guardarPersona(raiz, "../x")).toThrow();
  const roto = fixtureRepo({ ".claude/settings.local.json": "{ roto" });
  expect(() => guardarPersona(roto, "cami")).toThrow();
  expect(readFileSync(join(roto, ".claude/settings.local.json"), "utf8")).toBe("{ roto");
});
