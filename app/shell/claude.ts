import { type ChildProcess, spawn as spawnNode } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import type { EventoChat } from "../shared/puente";

const BASE = ["Read", "Edit", "Write", "Glob", "Grep", "Skill", "Bash(uv run *)", "Bash(git *)", "Bash(pnpm --dir app *)"];
// Conectores de claude.ai: solo los que leen. El nombre va tras el último "__" (a veces con prefijo: "notion-fetch").
const LECTURA = /^(?:[a-z]+[-_])?(list|get|search|read|fetch)/i;
const APROBACION = /^Ejecuta la aprobación /;
const SIN_SESION = /not logged in|please run \/login|invalid api key/i;
const SESION_PERDIDA = /no conversation found/i;
const RESULTADO_MAX = 300; // los tool_result (archivos leídos) pueden pesar megas: la UI solo mira el comienzo
// Abierta desde Finder, la app no hereda el PATH de la terminal: ahí suele vivir `claude` (y `uv` para los hooks).
const RUTAS = [`${homedir()}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"];

export const TEXTOS = {
  instalar: "Instala Claude Code para conversar aquí",
  sesion: "Inicia sesión con `claude` en la terminal",
  ocupado: "Espera a que Claude termine de responder",
  nueva: "No encontré la conversación anterior. Vuelve a enviar tu mensaje y empiezo una nueva.",
  fallo: "Claude no pudo terminar la respuesta. Inténtalo de nuevo.",
};

export const lecturaConectores = (herramientas: string[]): string[] =>
  herramientas.filter((h) => {
    const m = /^mcp__claude_ai_.+__(.+)$/.exec(h);
    return Boolean(m && LECTURA.test(m[1]));
  });

export function argsClaude({ mensaje, contexto, persona, sesion, envio = [], herramientas = [] }: {
  mensaje: string; contexto: string; persona: string; sesion?: string; envio?: string[]; herramientas?: string[];
}): string[] {
  const lista = [...BASE, ...lecturaConectores(herramientas), ...envio].join(",");
  return [
    "-p", `Estás viendo ${contexto}. Persona: ${persona}.\n\n${mensaje}`,
    "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", lista, ...(sesion ? ["--resume", sesion] : []),
  ];
}

type Deps = {
  raiz: string;
  spawn?: typeof spawnNode;
  persona: () => Promise<string>;
  /** Hash de HEAD antes del turno (para Deshacer). */
  head: () => Promise<string | null>;
  sesiones: { leer(id: string): string | undefined; guardar(id: string, sesion: string): void };
  sync: { pausar(): () => void; enCurso(): Promise<void> };
};
type Emitir = (e: EventoChat) => void;

/** Recorta lo pesado de un evento antes de mandarlo a la UI. */
function liviano(ev: Record<string, unknown>): Record<string, unknown> {
  const msj = ev.message as { content?: unknown } | undefined;
  if (ev.type !== "user" || !Array.isArray(msj?.content)) return ev;
  const content = msj.content.map((b: Record<string, unknown>) =>
    b.type === "tool_result" ? { ...b, content: typeof b.content === "string" ? b.content.slice(0, RESULTADO_MAX) : "" } : b);
  return { ...ev, message: { ...msj, content }, tool_use_result: undefined };
}

/** Chat con el `claude` de la persona. Puro Node (spawn inyectable): el cableado a Electron vive en main.ts. */
export function crearClaude(deps: Deps) {
  const spawn = deps.spawn ?? spawnNode;
  const vivos = new Map<string, ChildProcess>();
  const ocupados = new Set<string>();
  let herramientas: string[] = []; // las del último `init`: así se sabe qué conectores hay

  function correr(contextoId: string, args: string[], persona: string, emitir: Emitir): Promise<void> {
    return new Promise((resolver) => {
      const hijo = spawn("claude", args, {
        cwd: deps.raiz,
        env: { ...process.env, AOS_PERSONA: persona, PATH: [process.env.PATH, ...RUTAS].filter(Boolean).join(":") },
        stdio: ["ignore", "pipe", "pipe"],
      });
      vivos.set(contextoId, hijo);
      let suelto = ""; // lo que no es JSON (stderr y avisos): ahí aparece "Not logged in"
      let error: string | null = null;
      createInterface({ input: hijo.stdout! }).on("line", (linea) => {
        let ev: Record<string, unknown>;
        try { ev = JSON.parse(linea); } catch { suelto += `${linea}\n`; return; }
        if (ev.type === "system" && ev.subtype === "init" && Array.isArray(ev.tools)) herramientas = ev.tools as string[];
        if ((ev.type === "result" || ev.subtype === "init") && typeof ev.session_id === "string") deps.sesiones.guardar(contextoId, ev.session_id);
        if (ev.type === "result" && ev.is_error) error = String(ev.result ?? "") || TEXTOS.fallo;
        emitir({ tipo: "evento", evento: liviano(ev) });
      });
      hijo.stderr!.on("data", (d) => (suelto += String(d)));
      let listo = false;
      const terminar = (texto: string | null) => {
        if (listo) return;
        listo = true;
        vivos.delete(contextoId);
        if (texto) emitir({ tipo: "error", texto });
        emitir({ tipo: "fin" });
        resolver();
      };
      hijo.on("error", (e: NodeJS.ErrnoException) => terminar(e.code === "ENOENT" ? TEXTOS.instalar : TEXTOS.fallo));
      hijo.on("close", (codigo: number | null) => {
        if (SIN_SESION.test(`${suelto}${error ?? ""}`)) return terminar(TEXTOS.sesion);
        if (SESION_PERDIDA.test(`${suelto}${error ?? ""}`)) {
          deps.sesiones.guardar(contextoId, ""); // vacía = sin --resume la próxima vez
          return terminar(TEXTOS.nueva);
        }
        if (codigo === null) return terminar(null); // cancelado
        terminar(error ?? (codigo === 0 ? null : TEXTOS.fallo));
      });
    });
  }

  return {
    /** Un turno: pausa el sync, espera el que corre, guarda HEAD, corre `claude` y suelta la pausa al terminar. */
    async enviar(contextoId: string, mensaje: string, contexto: string, emitir: Emitir, envio: string[] = []): Promise<void> {
      if (ocupados.has(contextoId)) return emitir({ tipo: "error", texto: TEXTOS.ocupado });
      ocupados.add(contextoId);
      const reanudar = deps.sync.pausar();
      try {
        await deps.sync.enCurso();
        const [persona, commitPrevio] = await Promise.all([deps.persona(), deps.head().catch(() => null)]);
        emitir({ tipo: "inicio", commitPrevio });
        const args = argsClaude({
          mensaje, contexto, persona, herramientas, sesion: deps.sesiones.leer(contextoId),
          envio: APROBACION.test(mensaje) ? envio : [], // enviar hacia afuera solo al ejecutar una aprobación
        });
        await correr(contextoId, args, persona, emitir);
      } finally {
        ocupados.delete(contextoId);
        reanudar();
      }
    },
    cancelar(contextoId: string): void {
      vivos.get(contextoId)?.kill();
    },
    /** Al cerrar la ventana: ningún `claude` queda corriendo. */
    cancelarTodo(): void {
      vivos.forEach((h) => h.kill());
    },
  };
}
