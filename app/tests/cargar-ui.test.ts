import { join } from "node:path";
import { expect, test } from "vitest";
import { elegirUI } from "../shell/cargar-ui";
import { fixtureRepo } from "./helpers";

test("usa ui-dist del repo si el manifest lo permite", () => {
  const repo = fixtureRepo({ "app/ui-dist/index.html": "<html/>", "app/ui-dist/manifest.json": '{"minShell":1}' });
  expect(elegirUI(repo, 1)).toEqual({ origen: "repo", ruta: join(repo, "app/ui-dist/index.html") });
});

test("shell viejo → UI empaquetada con aviso", () => {
  const repo = fixtureRepo({ "app/ui-dist/index.html": "<html/>", "app/ui-dist/manifest.json": '{"minShell":2}' });
  const r = elegirUI(repo, 1);
  expect(r.origen).toBe("empaquetada");
  expect(r.aviso).toBe("Actualiza el marco para ver la última versión");
});

test("sin repo o sin ui-dist → empaquetada sin aviso", () => {
  expect(elegirUI(null, 1)).toEqual({ origen: "empaquetada", ruta: expect.stringMatching(/ui-dist\/index\.html$/) });
  const vacio = fixtureRepo({ "CLAUDE.md": "" });
  expect(elegirUI(vacio, 1)).toEqual({ origen: "empaquetada", ruta: expect.any(String) });
});

test("manifest ilegible → empaquetada sin aviso", () => {
  const repo = fixtureRepo({ "app/ui-dist/index.html": "<html/>", "app/ui-dist/manifest.json": "{roto" });
  expect(elegirUI(repo, 1).origen).toBe("empaquetada");
  expect(elegirUI(repo, 1).aviso).toBeUndefined();
});
