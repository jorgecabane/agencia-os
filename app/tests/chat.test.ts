import { beforeAll, describe, expect, it } from "vitest";
import type { EventoChat } from "../shared/puente";
import { alEvento, enviar, leerRevision } from "../ui/datos/chat";

const ev = (evento: Record<string, unknown>): EventoChat => ({ tipo: "evento", evento });
const usar = (id: string, name: string, ruta: string) =>
  ev({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: { file_path: `/repo/${ruta}` } }] } });
const resultado = (id: string, error = false) =>
  ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: error ? "String to replace not found" : "ok", is_error: error }] } });

beforeAll(() => {
  (globalThis as { window?: unknown }).window = {
    aos: { claude: { onEvento: () => () => {}, enviar: () => new Promise(() => {}), cancelar: () => {} } },
  };
});

describe("revisión en vivo", () => {
  it("un Edit que después falla sale de la revisión; las bases de turnos previos se mantienen", () => {
    enviar("t", "uno", "Hoy");
    alEvento("t", { tipo: "inicio", commitPrevio: "b1" });
    alEvento("t", ev({ type: "system", subtype: "init", cwd: "/repo" }));
    alEvento("t", usar("1", "Edit", "a.md"));
    alEvento("t", resultado("1"));
    alEvento("t", { tipo: "fin" });
    expect(leerRevision()).toEqual({ archivos: { "a.md": "b1" } });

    enviar("t", "dos", "Hoy");
    alEvento("t", { tipo: "inicio", commitPrevio: "b2" });
    alEvento("t", ev({ type: "system", subtype: "init", cwd: "/repo" }));
    alEvento("t", usar("2", "Edit", "b.md"));
    alEvento("t", usar("3", "Edit", "a.md"));
    expect(leerRevision()).toEqual({ archivos: { "a.md": "b1", "b.md": "b2" } }); // en vivo, antes del resultado
    alEvento("t", resultado("2", true));
    alEvento("t", resultado("3"));
    alEvento("t", { tipo: "fin" });
    expect(leerRevision()).toEqual({ archivos: { "a.md": "b1" } });
  });
});
