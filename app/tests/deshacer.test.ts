import { describe, expect, it, vi } from "vitest";
import type { EventoChat } from "../shared/puente";
import { archivosADeshacer, deshacer } from "../ui/datos/deshacer";

const ev = (evento: Record<string, unknown>): EventoChat => ({ tipo: "evento", evento });
const usar = (name: string, ruta: string) => ev({ type: "assistant", message: { content: [{ type: "tool_use", id: ruta, name, input: { file_path: ruta } }] } });

describe("archivosADeshacer", () => {
  it("rutas de Edit/Write del turno, relativas al repo, sin linea-de-tiempo.md ni sesiones/", () => {
    expect(archivosADeshacer([
      ev({ type: "system", subtype: "init", cwd: "/repo" }),
      usar("Read", "/repo/clientes/acme/brandbook.md"),
      usar("Edit", "/repo/clientes/acme/entregables/2026-10-30-post.md"),
      usar("Write", "/repo/clientes/acme/linea-de-tiempo.md"),
      usar("Write", "/repo/sesiones/x.md"),
      usar("Write", "/repo/bandeja/2026-10-27-aprobacion-post.md"),
      usar("Edit", "/repo/clientes/acme/entregables/2026-10-30-post.md"),
      usar("Write", "/otra/parte/fuera.md"),
    ])).toEqual(["clientes/acme/entregables/2026-10-30-post.md", "bandeja/2026-10-27-aprobacion-post.md"]);
  });
});

describe("archivosADeshacer: solo lo que se escribió", () => {
  it("no cuenta Edit/Write con error o rechazados; sí los que aún no tienen resultado", () => {
    const res = (id: string, extra: Record<string, unknown>) =>
      ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "x", ...extra }] } });
    expect(archivosADeshacer([
      ev({ type: "system", subtype: "init", cwd: "/repo" }),
      usar("Edit", "/repo/a.md"), res("/repo/a.md", { is_error: true, content: "String to replace not found" }),
      usar("Write", "/repo/b.md"), res("/repo/b.md", { is_error: true, content: "This command requires approval" }),
      usar("Write", "/repo/c.md"), res("/repo/c.md", {}),
      usar("Edit", "/repo/d.md"),
    ])).toEqual(["c.md", "d.md"]);
  });
});

describe("deshacer", () => {
  function aos(previos: Record<string, string>, historia: Record<string, string[]> = {}) {
    const orden: string[] = [];
    return {
      orden,
      repo: {
        write: vi.fn(async (r: string, c: string) => void orden.push(`write ${r} ${c}`)),
        delete: vi.fn(async (r: string) => void orden.push(`delete ${r}`)),
      },
      git: {
        log: vi.fn(async ({ desde, ruta }: { desde?: string; ruta?: string }) =>
          (historia[`${desde} ${ruta}`] ?? []).map((mensaje) => ({ hash: "h", autor: "", email: "", fecha: "", mensaje, rutas: [] }))),
        show: vi.fn(async (_h: string, r: string) => {
          if (r in previos) return previos[r];
          throw new Error(`Error invoking remote method 'git:show': fatal: path '${r}' does not exist in 'abc123'`);
        }),
      },
      sync: {
        pausar: () => (orden.push("pausar"), () => void orden.push("reanudar")),
        enCurso: async () => void orden.push("enCurso"),
        ahora: vi.fn(async (m?: string) => void orden.push(`ahora ${m}`)),
      },
    };
  }

  it("restaura lo que existía, borra lo nuevo y commitea 'app: deshacer <persona>' con el sync en pausa", async () => {
    const a = aos({ "clientes/acme/e.md": "antes" }, { "abc123 clientes/acme/e.md": ["sesión: cami 2026-10-27T14:00Z", "app: cami 2026-10-27T14:01Z"] });
    const r = await deshacer({ "clientes/acme/e.md": "abc123", "bandeja/nuevo.md": "abc123" }, "cami", a);
    expect(a.orden).toEqual([
      "pausar", "enCurso", "write clientes/acme/e.md antes", "delete bandeja/nuevo.md", "ahora app: deshacer cami", "reanudar",
    ]);
    expect(r.omitidos).toEqual([]);
  });

  it("cada archivo vuelve a la base de su primer turno, y no pisa lo que otro cambió después", async () => {
    const a = aos({ "a.md": "a en t1" }, { "t2 b.md": ["app: jorge 2026-10-27T15:00Z"], "t1 a.md": ["app: deshacer cami"] });
    a.git.show.mockImplementation(async (h: string, r: string) => `${r}@${h}`);
    const r = await deshacer({ "a.md": "t1", "b.md": "t2" }, "cami", a);
    expect(a.git.show).toHaveBeenCalledWith("t1", "a.md");
    expect(a.orden).toEqual(["pausar", "enCurso", "write a.md a.md@t1", "ahora app: deshacer cami", "reanudar"]);
    expect(r.omitidos).toEqual(["b.md"]);
  });

  it("el commit de otra persona con un nombre que empieza igual (camila) es ajeno", async () => {
    const a = aos({}, { "t1 b.md": ["app: deshacer camila"], "t1 c.md": ["app: camila 2026-10-27T15:00Z"] });
    expect(await deshacer({ "b.md": "t1", "c.md": "t1" }, "cami", a)).toEqual({ omitidos: ["b.md", "c.md"] });
  });

  it("si todo quedó omitido no commitea", async () => {
    const a = aos({}, { "t1 b.md": ["sesión: jorge 2026-10-27T15:00Z"] });
    expect(await deshacer({ "b.md": "t1" }, "cami", a)).toEqual({ omitidos: ["b.md"] });
    expect(a.sync.ahora).not.toHaveBeenCalled();
  });

  it("si git falla por otra razón no borra nada y avisa", async () => {
    const a = aos({});
    a.git.show.mockRejectedValueOnce(new Error("fatal: bad object abc123"));
    await expect(deshacer({ "clientes/acme/e.md": "abc123" }, "cami", a)).rejects.toThrow("bad object");
    expect(a.repo.delete).not.toHaveBeenCalled();
    expect(a.orden.at(-1)).toBe("reanudar");
  });
});
