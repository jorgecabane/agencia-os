import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { EventoChat } from "../shared/puente";
import { argsClaude, crearClaude, lecturaConectores } from "../shell/claude";

const FIXTURE = readFileSync(join(__dirname, "fixtures/stream-json.jsonl"), "utf8");

describe("argsClaude", () => {
  it("sin sesión no lleva --resume; lleva el prefijo de contexto y la lista base", () => {
    const a = argsClaude({ mensaje: "hola", contexto: "Hoy", persona: "cami" });
    expect(a.slice(0, 2)).toEqual(["-p", "Estás viendo Hoy. Persona: cami.\n\nhola"]);
    expect(a).not.toContain("--resume");
    expect(a).toEqual(expect.arrayContaining(["--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits"]));
    const lista = a[a.indexOf("--allowedTools") + 1].split(",");
    expect(lista).toEqual(["Read", "Edit", "Write", "Glob", "Grep", "Skill", "Bash(uv run *)", "Bash(git *)", "Bash(pnpm --dir app *)"]);
  });

  it("con sesión agrega --resume y con envio suma esas herramientas", () => {
    const a = argsClaude({ mensaje: "Ejecuta la aprobación bandeja/x.md", contexto: "bandeja/x.md", persona: "cami", sesion: "s1", envio: ["mcp__claude_ai_Gmail__send_email"] });
    expect(a.slice(-2)).toEqual(["--resume", "s1"]);
    expect(a[a.indexOf("--allowedTools") + 1]).toContain("mcp__claude_ai_Gmail__send_email");
  });

  it("rechaza nombres que solo contienen un verbo de lectura", () => {
    expect(lecturaConectores([
      "mcp__claude_ai_Notion__delete_list_item", "mcp__claude_ai_Shop__update_listing", "mcp__claude_ai_Gmail__getaway_send",
      "mcp__claude_ai_X__notion-fetch", "mcp__claude_ai_Gmail__readers_send", "mcp__claude_ai_Gmail__send_read_receipt",
    ])).toEqual([]);
  });

  it("solo las herramientas de lectura de los conectores", () => {
    expect(lecturaConectores([
      "Read", "mcp__claude_ai_Claude_Docs__read", "mcp__claude_ai_Claude_Docs__create", "mcp__claude_ai_Gmail__search_threads",
      "mcp__claude_ai_Gmail__send_email", "mcp__claude_ai_Notion__notion-fetch", "mcp__otro__get_x", "mcp__claude_ai_Slack__slack_list_channels",
    ])).toEqual(["mcp__claude_ai_Claude_Docs__read", "mcp__claude_ai_Gmail__search_threads", "mcp__claude_ai_Notion__notion-fetch", "mcp__claude_ai_Slack__slack_list_channels"]);
  });
});

/** Un `spawn` falso: `guion` escribe en el hijo y decide cómo termina. */
function falso(guion: (h: Hijo) => void) {
  const llamadas: { args: string[]; opciones: { cwd?: string; env?: NodeJS.ProcessEnv } }[] = [];
  const spawn = vi.fn((_cmd: string, args: string[], opciones: object) => {
    llamadas.push({ args, opciones });
    const h: Hijo = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => cerrar(h, null)) });
    setTimeout(() => guion(h), 0);
    return h;
  });
  return { spawn, llamadas };
}
type Hijo = EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => void };
const cerrar = (h: Hijo, codigo: number | null) => { h.stdout.end(); h.stderr.end(); setTimeout(() => h.emit("close", codigo), 5); };

function armar(guion: (h: Hijo) => void, sesiones: Record<string, string> = {}, estadoSync = "al-dia") {
  const { spawn, llamadas } = falso(guion);
  const orden: string[] = [];
  const reanudar = vi.fn(() => orden.push("reanudar"));
  const claude = crearClaude({
    raiz: "/repo",
    spawn: spawn as never,
    persona: async () => "cami",
    head: async () => "abc123",
    sesiones: { leer: (id) => sesiones[id], guardar: (id, s) => (sesiones[id] = s) },
    sync: {
      pausar: () => (orden.push("pausar"), reanudar), enCurso: async () => void orden.push("enCurso"),
      ahora: async () => void orden.push("ahora"), estado: () => estadoSync,
    },
  });
  const eventos: EventoChat[] = [];
  const enviar = (msg = "hola", envio?: string[]) => claude.enviar("global", msg, "Todo el espacio", (e) => eventos.push(e), envio);
  return { claude, enviar, eventos, llamadas, orden, reanudar, sesiones };
}

describe("crearClaude", () => {
  it("pausa el sync, espera el que corre, commitea lo pendiente, avisa el commit previo, reenvía eventos y guarda la sesión", async () => {
    const t = armar((h) => { h.stdout.write(FIXTURE); cerrar(h, 0); });
    await t.enviar();
    expect(t.orden).toEqual(["pausar", "enCurso", "ahora", "reanudar"]);
    expect(t.eventos[0]).toEqual({ tipo: "inicio", commitPrevio: "abc123" });
    expect(t.eventos.filter((e) => e.tipo === "evento")).toHaveLength(FIXTURE.trim().split("\n").length);
    expect(t.eventos.at(-1)).toEqual({ tipo: "fin" });
    expect(t.sesiones.global).toBe("0c75ed64-fa45-48ce-97ed-4ffcb736bc17");
    expect(t.llamadas[0].opciones.cwd).toBe("/repo");
    expect(t.llamadas[0].opciones.env?.AOS_PERSONA).toBe("cami");
  });

  it("la segunda vez sigue la conversación con --resume", async () => {
    const t = armar((h) => cerrar(h, 0), { global: "s-previa" });
    await t.enviar();
    expect(t.llamadas[0].args.slice(-2)).toEqual(["--resume", "s-previa"]);
  });

  it("claude no instalado (ENOENT) → error que pide instalar, y suelta la pausa", async () => {
    const t = armar((h) => h.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" })));
    await t.enviar();
    expect(t.eventos).toContainEqual({ tipo: "error", texto: "Instala Claude Code para conversar aquí" });
    expect(t.reanudar).toHaveBeenCalledTimes(1);
  });

  it("sin sesión iniciada → pide iniciar sesión en la terminal", async () => {
    const t = armar((h) => { h.stdout.write("Not logged in · Please run /login\n"); cerrar(h, 1); });
    await t.enviar();
    expect(t.eventos).toContainEqual({ tipo: "error", texto: "Inicia sesión con `claude` en la terminal" });
    expect(t.eventos.filter((e) => e.tipo === "error")).toHaveLength(1);
  });

  it("envio solo vale en el turno de 'Ejecuta la aprobación'", async () => {
    const t = armar((h) => cerrar(h, 0));
    await t.enviar("Publica esto ya", ["mcp__claude_ai_Gmail__send_email"]);
    await t.enviar("Ejecuta la aprobación bandeja/2026-10-27-aprobacion-x.md", ["mcp__claude_ai_Gmail__send_email"]);
    const lista = (k: number) => t.llamadas[k].args[t.llamadas[k].args.indexOf("--allowedTools") + 1];
    expect(lista(0)).not.toContain("send_email");
    expect(lista(1)).toContain("send_email");
  });

  it("cancelar mata el proceso del contexto y termina sin error", async () => {
    const t = armar(() => {});
    const turno = t.enviar();
    await vi.waitFor(() => expect(t.llamadas).toHaveLength(1));
    t.claude.cancelar("global");
    await turno;
    expect(t.eventos.map((e) => e.tipo)).toEqual(["inicio", "fin"]);
    expect(t.reanudar).toHaveBeenCalledTimes(1);
  });

  it("un turno a la vez en toda la app, aunque sean contextos distintos", async () => {
    const t = armar((h) => cerrar(h, 0));
    await Promise.all([t.enviar(), t.claude.enviar("clientes/acme", "hola", "clientes/acme", (e) => t.eventos.push(e))]);
    expect(t.llamadas).toHaveLength(1);
    expect(t.eventos).toContainEqual({ tipo: "error", texto: "Espera a que Claude termine de responder" });
  });
});

describe("crearClaude: bordes", () => {
  it("si commitear lo pendiente deja un conflicto, no corre el turno", async () => {
    const t = armar(() => {}, {}, "conflicto");
    await t.enviar();
    expect(t.llamadas).toHaveLength(0);
    expect(t.eventos).toEqual([{ tipo: "error", texto: "Hay un conflicto con cambios del equipo. Resuélvelo antes de pedirle algo a Claude." }, { tipo: "fin" }]);
    expect(t.reanudar).toHaveBeenCalledTimes(1);
  });

  it("envio inválido (no es lista o no es un conector) → no corre", async () => {
    const t = armar((h) => cerrar(h, 0));
    await t.enviar("Ejecuta la aprobación bandeja/x.md", ["Bash(rm -rf *)"]);
    await t.enviar("Ejecuta la aprobación bandeja/x.md", "mcp__claude_ai_Gmail__send" as never);
    expect(t.llamadas).toHaveLength(0);
    expect(t.eventos.filter((e) => e.tipo === "error")).toHaveLength(2);
  });

  it("un result con error muestra el texto genérico, no el crudo", async () => {
    const r = JSON.stringify({ type: "result", is_error: true, result: "API Error: 529 overloaded_error {...}", session_id: "s" });
    const t = armar((h) => { h.stdout.write(`${r}\n`); cerrar(h, 1); });
    await t.enviar();
    expect(t.eventos.filter((e) => e.tipo === "error")).toEqual([{ tipo: "error", texto: "Claude no pudo terminar la respuesta. Inténtalo de nuevo." }]);
  });
});

describe("crearClaude: conversación perdida", () => {
  it("si --resume no la encuentra, la olvida y pide reenviar", async () => {
    const t = armar((h) => { h.stderr.write("No conversation found with session ID: s-vieja\n"); cerrar(h, 1); }, { global: "s-vieja" });
    await t.enviar();
    expect(t.sesiones.global).toBe("");
    expect(t.eventos).toContainEqual({ tipo: "error", texto: "No encontré la conversación anterior. Vuelve a enviar tu mensaje y empiezo una nueva." });
  });
});
