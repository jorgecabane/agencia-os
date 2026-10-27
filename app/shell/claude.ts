import { type ChildProcess, spawn as spawnNode } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import type { EventoChat } from "../shared/puente";

const BASE = ["Read", "Edit", "Write", "Glob", "Grep", "Skill", "Bash(uv run *)", "Bash(git *)", "Bash(pnpm --dir app *)"];
// Conectores de claude.ai: solo los que leen. El verbo va primero, o tras el nombre del propio servidor ("notion-fetch").
const CONECTOR = /^mcp__claude_ai_(.+?)__(.+)$/;
const LECTURA = /^(list|get|search|read|fetch)(?:[-_]|$)/i;
const ENVIO = /^mcp__claude_ai_[A-Za-z0-9_-]+$/;
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
  conflicto: "Hay un conflicto con cambios del equipo. Resuélvelo antes de pedirle algo a Claude.",
  envio: "No puedo usar esas herramientas de envío.",
};

export const lecturaConectores = (herramientas: string[]): string[] =>
  herramientas.filter((h) => {
    const m = CONECTOR.exec(h);
    if (!m) return false;
    const [, servidor, nombre] = m;
    const prefijo = nombre.slice(0, servidor.length + 1).toLowerCase();
    const sinPrefijo = prefijo === `${servidor.toLowerCase()}-` || prefijo === `${servidor.toLowerCase()}_` ? nombre.slice(servidor.length + 1) : nombre;
    return LECTURA.test(sinPrefijo);
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
  sync: { pausar(): () => void; enCurso(): Promise<void>; ahora(): Promise<void>; estado(): string };
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
  // Un turno a la vez en toda la app: el `sync.ahora()` de un turno nunca sube lo que otro dejó a medias.
  let ocupado = false;
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
      let error: string | null = null; // texto crudo del result fallido: solo para reconocer casos conocidos
      createInterface({ input: hijo.stdout! }).on("line", (linea) => {
        let ev: Record<string, unknown>;
        try { ev = JSON.parse(linea); } catch { suelto += `${linea}\n`; return; }
        if (ev.type === "system" && ev.subtype === "init" && Array.isArray(ev.tools)) herramientas = ev.tools as string[];
        if ((ev.type === "result" || ev.subtype === "init") && typeof ev.session_id === "string") deps.sesiones.guardar(contextoId, ev.session_id);
        if (ev.type === "result" && ev.is_error) error = String(ev.result ?? "");
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
        terminar(error !== null || codigo !== 0 ? TEXTOS.fallo : null);
      });
    });
  }

  return {
    /** Un turno: pausa el sync, espera el que corre, commitea lo pendiente, guarda HEAD, corre `claude` y suelta la pausa al terminar. */
    async enviar(contextoId: string, mensaje: string, contexto: string, emitir: Emitir, envio: string[] = []): Promise<void> {
      const fallar = (texto: string) => { emitir({ tipo: "error", texto }); emitir({ tipo: "fin" }); };
      if (ocupado) return fallar(TEXTOS.ocupado);
      if (!Array.isArray(envio) || !envio.every((h) => typeof h === "string" && ENVIO.test(h))) return fallar(TEXTOS.envio);
      ocupado = true;
      const reanudar = deps.sync.pausar();
      try {
        await deps.sync.enCurso();
        // Lo que la persona dejó sin commitear (el sync espera 5 s de calma) entra a la base de Deshacer.
        await deps.sync.ahora();
        if (deps.sync.estado() === "conflicto") return fallar(TEXTOS.conflicto);
        const [persona, commitPrevio] = await Promise.all([deps.persona(), deps.head().catch(() => null)]);
        emitir({ tipo: "inicio", commitPrevio });
        const args = argsClaude({
          mensaje, contexto, persona, herramientas, sesion: deps.sesiones.leer(contextoId),
          envio: APROBACION.test(mensaje) ? envio : [], // enviar hacia afuera solo al ejecutar una aprobación
        });
        await correr(contextoId, args, persona, emitir);
      } finally {
        ocupado = false;
        reanudar();
      }
    },
    /** Hay un turno corriendo (en cualquier contexto). */
    ocupado: (): boolean => ocupado,
    cancelar(contextoId: string): void {
      vivos.get(contextoId)?.kill();
    },
    /** Al cerrar la ventana: ningún `claude` queda corriendo. */
    cancelarTodo(): void {
      vivos.forEach((h) => h.kill());
    },
  };
}
