import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearRepo, ESPERA_CAMBIOS_MS } from "../shell/repo";
import { fixtureRepo } from "./helpers";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("puente de archivos", () => {
  it("escribe atómico, con contenido exacto, creando carpetas y sin dejar temporales", async () => {
    const dir = fixtureRepo({});
    const repo = crearRepo(dir);
    await repo.write("a/b/nota.md", "hola\n  ñ");
    expect(readFileSync(join(dir, "a/b/nota.md"), "utf8")).toBe("hola\n  ñ");
    expect(readdirSync(join(dir, "a/b"))).toEqual(["nota.md"]);
  });

  it("rechaza rutas fuera del repo en todas las operaciones", async () => {
    const repo = crearRepo(fixtureRepo({ "x.md": "x" }));
    const malas = ["../x", "/etc/x", ".", "", ".git", ".git/config"];
    for (const ruta of malas) {
      await expect(repo.write(ruta, "")).rejects.toThrow("ruta fuera del repo");
      if (!ruta.startsWith(".git")) await expect(repo.read(ruta)).rejects.toThrow("ruta fuera del repo");
      await expect(repo.delete(ruta)).rejects.toThrow("ruta fuera del repo");
      await expect(repo.move("x.md", ruta)).rejects.toThrow("ruta fuera del repo");
      await expect(repo.move(ruta, "y.md")).rejects.toThrow("ruta fuera del repo");
      if (ruta.startsWith("/") || ruta.startsWith("..")) await expect(repo.list(ruta)).rejects.toThrow("ruta fuera del repo");
    }
  });

  it("acepta nombres que empiezan con dos puntos", async () => {
    const repo = crearRepo(fixtureRepo({}));
    await repo.write("..foo.md", "ok");
    expect(await repo.read("..foo.md")).toBe("ok");
  });

  it("escrituras concurrentes a la misma ruta no chocan ni dejan temporales", async () => {
    const dir = fixtureRepo({});
    const repo = crearRepo(dir);
    await Promise.all([repo.write("c.md", "A"), repo.write("c.md", "B")]);
    expect(["A", "B"]).toContain(readFileSync(join(dir, "c.md"), "utf8"));
    expect(readdirSync(dir)).toEqual(["c.md"]);
  });

  it("lista las fichas y omite .git, node_modules y ui-dist", async () => {
    const dir = fixtureRepo({ ".git/c.md": "", "node_modules/p/c.md": "", "app/ui-dist/c.md": "", "clientes/z/c.md": "" });
    expect(await crearRepo(dir).list("**/c.md")).toEqual(["clientes/z/c.md"]);
    const fixture = crearRepo(resolve(__dirname, "../../tests/fixtures/repo"));
    expect((await fixture.list("clientes/**/*.md")).sort()).toEqual(["clientes/acme/_ficha.md", "clientes/beta/_ficha.md"]);
  });

  it("mueve, lee y borra", async () => {
    const repo = crearRepo(fixtureRepo({ "a.md": "uno" }));
    await repo.move("a.md", "sub/b.md");
    expect(await repo.read("sub/b.md")).toBe("uno");
    await repo.delete("sub/b.md");
    expect(await repo.list("**/*.md")).toEqual([]);
  });

  it("agrupa dos escrituras seguidas en un solo evento", async () => {
    const repo = crearRepo(fixtureRepo({}));
    const eventos: string[][] = [];
    const parar = repo.onCambio((rutas) => eventos.push(rutas));
    await espera(100);
    await repo.write("uno.md", "1");
    await repo.write("dos.md", "2");
    await espera(ESPERA_CAMBIOS_MS * 3);
    parar();
    expect(eventos).toEqual([["dos.md", "uno.md"]]);
  });
});
