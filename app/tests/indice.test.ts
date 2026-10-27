import { readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";
import { actualizarIndice, construirIndice } from "../ui/datos/indice";

const RAIZ = join(__dirname, "../../tests/fixtures/repo");
const archivos = () =>
  new Map(fg.sync("**/*.md", { cwd: RAIZ }).map((r) => [r, readFileSync(join(RAIZ, r), "utf8")] as const));

const ENT = "clientes/acme/entregables/2026-10-30-post.md";
const entregable = (estado: string) =>
  `---\ntipo: entregable\ncliente: acme\nformato: post\nvence: 2026-10-30\nestado: ${estado}\nresponsable: jorge\n---\n`;

describe("índice", () => {
  it("lee el repo de prueba: 2 clientes y los entregables de acme", () => {
    const a = archivos().set(ENT, entregable("brief"));
    const i = construirIndice(a);
    expect(i.clientes.map((c) => c.slug)).toEqual(["acme", "beta"]);
    expect(i.entregables).toEqual([expect.objectContaining({ ruta: ENT, cliente: "acme", vence: "2026-10-30" })]);
    expect(i.rotos).toEqual([]);
  });

  it("un archivo roto va a rotos sin lanzar", () => {
    const i = construirIndice(new Map([
      ["clientes/x/_ficha.md", "---\ntipo: cliente\nnombre: X\n"],
      ["clientes/y/_ficha.md", "---\ntipo: cliente\nnombre: Y\n---\n"],
    ]));
    expect(i.clientes).toEqual([]);
    expect(i.rotos.map((r) => r.ruta)).toEqual(["clientes/x/_ficha.md", "clientes/y/_ficha.md"]);
  });

  it("actualizar reemplaza, agrega y borra sin mutar el original", () => {
    const base = construirIndice(archivos().set(ENT, entregable("brief")));
    const i2 = actualizarIndice(base, new Map<string, string | null>([[ENT, entregable("revision")]]));
    expect(i2.entregables[0].estado).toBe("revision");
    expect(base.entregables[0].estado).toBe("brief");
    expect(actualizarIndice(i2, new Map([[ENT, null]])).entregables).toEqual([]);
  });

  it("reuniones llevan link y asistentes", () => {
    const r = "clientes/acme/reuniones/2026-10-01-k.md";
    const i = construirIndice(new Map([[r, "---\ntipo: reunion\ncliente: acme\nfecha: 2026-10-01\nlink: https://x.cl\nasistentes: [ana]\n---\n"]]));
    expect(i.reuniones[0]).toMatchObject({ link: "https://x.cl", asistentes: ["ana"] });
  });
});
