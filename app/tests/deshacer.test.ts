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

describe("deshacer", () => {
  function aos(previos: Record<string, string>) {
    const orden: string[] = [];
    return {
      orden,
      repo: {
        write: vi.fn(async (r: string, c: string) => void orden.push(`write ${r} ${c}`)),
        delete: vi.fn(async (r: string) => void orden.push(`delete ${r}`)),
      },
      git: {
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
    const a = aos({ "clientes/acme/e.md": "antes" });
    await deshacer(["clientes/acme/e.md", "bandeja/nuevo.md"], "abc123", "cami", a);
    expect(a.orden).toEqual([
      "pausar", "enCurso", "write clientes/acme/e.md antes", "delete bandeja/nuevo.md", "ahora app: deshacer cami", "reanudar",
    ]);
  });

  it("si git falla por otra razón no borra nada y avisa", async () => {
    const a = aos({});
    a.git.show.mockRejectedValueOnce(new Error("fatal: bad object abc123"));
    await expect(deshacer(["clientes/acme/e.md"], "abc123", "cami", a)).rejects.toThrow("bad object");
    expect(a.repo.delete).not.toHaveBeenCalled();
    expect(a.orden.at(-1)).toBe("reanudar");
  });
});
