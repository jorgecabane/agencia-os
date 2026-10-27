import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EventoChat } from "../shared/puente";
import { bloques, paso } from "../ui/datos/pasos";

const ev = (evento: Record<string, unknown>): EventoChat => ({ tipo: "evento", evento });
const FIXTURE: EventoChat[] = readFileSync(join(__dirname, "fixtures/stream-json.jsonl"), "utf8").trim().split("\n").map((l) => ev(JSON.parse(l)));
const ok = { error: false, rechazado: false };
const usar = (name: string, input: Record<string, unknown>, id = name) =>
  ev({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const resultado = (id: string, extra: Record<string, unknown> = {}) =>
  ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok", ...extra }] } });

describe("paso", () => {
  it("Read del brandbook → 'Leí el brandbook'", () => {
    expect(paso({ name: "Read", input: { file_path: "/repo/clientes/acme/brandbook.md" } }, ok, "/repo")).toEqual({ texto: "Leí el brandbook", estado: "ok" });
  });
  it("Skill ig-carousel → 'Usando ig-carousel', corriendo hasta que llega el resultado", () => {
    expect(paso({ name: "Skill", input: { skill: "ig-carousel" } })).toEqual({ texto: "Usando ig-carousel", estado: "corriendo" });
  });
  it("Edit/Write → 'Edité <título>'", () => {
    const uso = { name: "Edit", input: { file_path: "/repo/clientes/acme/entregables/2026-10-30-post-jueves.md" } };
    expect(paso(uso, ok, "/repo")).toEqual({ texto: "Edité Post jueves", estado: "ok" });
    expect(paso({ ...uso, name: "Write" }, ok, "/repo").texto).toBe("Edité Post jueves");
  });
  it("denegado → 'No tengo permiso para <herramienta>' como paso fallido", () => {
    expect(paso({ name: "WebFetch", input: { url: "https://x.cl" } }, { error: true, rechazado: true })).toEqual({ texto: "No tengo permiso para WebFetch", estado: "error" });
    expect(paso({ name: "Bash", input: { command: "python3 -c 'print(1)'" } }, { error: true, rechazado: true }).texto)
      .toBe("No tengo permiso para Bash(python3 -c 'print(1)')");
  });
});

describe("bloques", () => {
  it("arma texto y pasos en orden desde el stream real, y detecta el rechazo por tool_result_meta", () => {
    const b = bloques(FIXTURE);
    expect(b[0]).toEqual({ tipo: "texto", texto: "Hola." });
    expect(b[1]).toEqual({ tipo: "pasos", pasos: [
      { id: "toolu_01AmwrMBCmsM22zFHmq9wYyu", texto: "Leí X.txt", estado: "error" },
      { id: "toolu_01MqHFpQnaK2vcibNSoNX5qM", texto: "Edité Y.txt", estado: "ok" },
    ] });
    const pasos = b.flatMap((x) => (x.tipo === "pasos" ? x.pasos : []));
    expect(pasos.at(-1)).toMatchObject({ texto: "No tengo permiso para Bash(python3 -c 'print(1)')", estado: "error" });
  });

  it("tarjeta de aprobación cuando Claude escribe un bandeja/*aprobacion*", () => {
    const b = bloques([
      ev({ type: "system", subtype: "init", cwd: "/repo", session_id: "s" }),
      usar("Write", { file_path: "/repo/bandeja/2026-10-27-aprobacion-post-acme.md" }, "w1"), resultado("w1"),
      usar("Edit", { file_path: "/repo/bandeja/2026-10-27-aprobacion-post-acme.md" }, "w2"), resultado("w2"),
    ]);
    expect(b.filter((x) => x.tipo === "aprobacion")).toEqual([{ tipo: "aprobacion", ruta: "bandeja/2026-10-27-aprobacion-post-acme.md" }]);
  });

  it("un rechazo con el texto antiguo (sin meta) también cuenta", () => {
    const b = bloques([usar("WebFetch", {}, "f"), resultado("f", { is_error: true, content: "Claude requested permissions to use WebFetch, but you haven't granted it yet." })]);
    expect(b).toEqual([{ tipo: "pasos", pasos: [{ id: "f", texto: "No tengo permiso para WebFetch", estado: "error" }] }]);
  });
});
