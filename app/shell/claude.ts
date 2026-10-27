import { type ChildProcess, spawn as spawnNode } from "node:child_process";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parse } from "yaml";
import { type EventoChat, MOTIVO_CONFLICTO } from "../shared/puente";

const BASE = ["Read", "Edit", "Write", "Glob", "Grep", "Skill", "Bash(uv run *)", "Bash(git *)", "Bash(pnpm --dir app *)"];
// Conectores de claude.ai: solo los que leen. El verbo va primero, o tras el nombre del propio servidor ("notion-fetch").
const CONECTOR = /^mcp__claude_ai_(.+?)__(.+)$/;
const LECTURA = /^(list|get|search|read|fetch)(?:[-_]|$)/i;
// Solo el mensaje exacto que manda Aprobaciones; la ruta no puede salir de bandeja/.
const EJECUTA = /^Ejecuta la aprobación (bandeja\/[^/\s]+\.md)$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
// Servidor de anuncios: "Ads" como palabra (Meta_Ads, Google_Ads, GoogleAds), no "Threads" ni "Uploads".
const ADS = "(?:^|[-_]|google|meta|facebook)ads(?:[-_]|$)";
const SIN_ADS = `^(?!.*${ADS})`; // un post o un DM nunca gasta en anuncios
const verbos = (...v: string[]) => new RegExp(`^(${v.join("|")})(?:[-_]|$)`, "i");
/** Qué conector y qué verbos puede usar cada canal de una aprobación. `otro` no tiene: se envía a mano. */
const CANALES: Record<string, { servidor: RegExp; verbo: RegExp }> = {
  email: { servidor: /gmail/i, verbo: verbos("send", "reply", "draft", "create[-_]draft") },
  instagram: { servidor: new RegExp(`${SIN_ADS}.*(instagram|meta|facebook)`, "i"), verbo: verbos("publish", "post", "create", "schedule", "upload") }, // los mensajes son del canal dm
  dm: { servidor: new RegExp(`${SIN_ADS}.*(instagram|meta|facebook|messenger|whatsapp)`, "i"), verbo: verbos("send", "reply") },
  ads: { servidor: new RegExp(ADS, "i"), verbo: verbos("create", "update", "publish", "launch") },
};
const SIN_SESION = /not logged in|please run \/login|invalid api key/i;
const SESION_PERDIDA = /no conversation found/i;
const RESULTADO_MAX = 300; // los tool_result (archivos leídos) pueden pesar megas: la UI solo mira el comienzo
// Abierta desde Finder, la app no hereda el PATH de la terminal: ahí suele vivir `claude` (y `uv` para los hooks).
export const RUTAS = [`${homedir()}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"];

export const TEXTOS = {
  instalar: "Instala Claude Code para conversar aquí",
  sesion: "Inicia sesión con `claude` en la terminal",
  ocupado: "Espera a que Claude termine de responder",
  nueva: "No encontré la conversación anterior. Vuelve a enviar tu mensaje y empiezo una nueva.",
  fallo: "Claude no pudo terminar la respuesta. Inténtalo de nuevo.",
  conflicto: "Hay un conflicto con cambios del equipo. Resuélvelo antes de pedirle algo a Claude.",
  noAprobada: "Esa aprobación no existe o todavía no está aprobada.",
  canalOtro: "Las aprobaciones de canal «otro» no las envía Claude: envíala tú y márcala como ejecutada.",
  sinConector: (canal: string) =>
    `No encontré un conector para enviar por ${canal}. Conéctalo en claude.ai → Connectors (si ya está, conversa una vez con Claude para que lo reconozca) y vuelve a intentarlo.`,
};

/** Servidor de un conector de claude.ai y el nombre de la herramienta sin el prefijo del servidor. */
function conector(h: string): { servidor: string; nombre: string } | null {
  const m = CONECTOR.exec(h);
  if (!m) return null;
  const [, servidor, nombre] = m;
  const prefijo = nombre.slice(0, servidor.length + 1).toLowerCase();
  const propio = prefijo === `${servidor.toLowerCase()}-` || prefijo === `${servidor.toLowerCase()}_`;
  return { servidor, nombre: propio ? nombre.slice(servidor.length + 1) : nombre };
}

export const lecturaConectores = (herramientas: string[]): string[] =>
  herramientas.filter((h) => { const c = conector(h); return c !== null && LECTURA.test(c.nombre); });

/** Las herramientas de envío que corresponden al canal de una aprobación (de las que trae el último `init`). */
export function herramientasDeEnvio(canal: string, herramientas: string[]): string[] {
  const regla = Object.hasOwn(CANALES, canal) ? CANALES[canal] : null;
  if (!regla) return [];
  return herramientas.filter((h) => { const c = conector(h); return c !== null && regla.servidor.test(c.servidor) && regla.verbo.test(c.nombre); });
}

/**
 * Lo que el shell deja enviar en este turno. Solo "Ejecuta la aprobación bandeja/<x>.md", leyendo el archivo
 * aquí (no se confía en la UI): `tipo: aprobacion`, `estado: aprobado` y herramientas solo de su `canal`.
 */
export async function permisoEnvio(raiz: string, mensaje: string, herramientas: string[]): Promise<{ envio: string[] } | { error: string }> {
  const ruta = EJECUTA.exec(mensaje)?.[1];
  if (!ruta) return { envio: [] };
  let meta: Record<string, unknown> | null = null;
  try {
    const fm = FRONTMATTER.exec(await readFile(join(raiz, ruta), "utf8"))?.[1];
    meta = fm ? parse(fm) : null;
  } catch { /* no existe o el YAML está roto: no hay permiso */ }
  if (meta?.tipo !== "aprobacion" || meta.estado !== "aprobado") return { error: TEXTOS.noAprobada };
  const canal = String(meta.canal);
  if (!Object.hasOwn(CANALES, canal)) return { error: TEXTOS.canalOtro };
  const envio = herramientasDeEnvio(canal, herramientas);
  return envio.length ? { envio } : { error: TEXTOS.sinConector(canal) };
}

export function argsClaude({ mensaje, contexto, persona, sesion, envio = [], herramientas = [] }: {
  mensaje: string; contexto: string; persona: string; sesion?: string; envio?: string[]; herramientas?: string[];
}): string[] {
  const permitidas = [...BASE, ...lecturaConectores(herramientas), ...envio];
  // Negar gana sobre permitir: así un "no volver a preguntar" guardado en otra parte no deja enviar.
  // Sin `init` previo no se conocen los conectores (y no hay envío posible): ahí protege solo --setting-sources.
  const negadas = herramientas.filter((h) => h.startsWith("mcp__") && !permitidas.includes(h));
  return [
    "-p", `Estás viendo ${contexto}. Persona: ${persona}.\n\n${mensaje}`,
    "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    // Solo la configuración del repo (ahí viven los hooks): ni ~/.claude ni settings.local.json suman permisos.
    "--setting-sources", "project",
    "--allowedTools", permitidas.join(","),
    ...(negadas.length ? ["--disallowedTools", negadas.join(",")] : []),
    ...(sesion ? ["--resume", sesion] : []),
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
    async enviar(contextoId: string, mensaje: string, contexto: string, emitir: Emitir): Promise<void> {
      const fallar = (texto: string) => { emitir({ tipo: "error", texto }); emitir({ tipo: "fin" }); };
      if (ocupado) return fallar(TEXTOS.ocupado);
      ocupado = true;
      const reanudar = deps.sync.pausar();
      try {
        await deps.sync.enCurso();
        // En conflicto solo pasa el pedido de mezclarlo, sin sincronizar antes (volvería a chocar).
        const mezclar = mensaje === MOTIVO_CONFLICTO && deps.sync.estado() === "conflicto";
        // Lo que la persona dejó sin commitear (el sync espera 5 s de calma) entra a la base de Deshacer.
        if (!mezclar) await deps.sync.ahora();
        if (!mezclar && deps.sync.estado() === "conflicto") return fallar(TEXTOS.conflicto);
        const permiso = await permisoEnvio(deps.raiz, mensaje, herramientas); // enviar hacia afuera solo al ejecutar una aprobación
        if ("error" in permiso) return fallar(permiso.error);
        const [persona, commitPrevio] = await Promise.all([deps.persona(), deps.head().catch(() => null)]);
        emitir({ tipo: "inicio", commitPrevio });
        const args = argsClaude({
          mensaje, contexto, persona, herramientas, sesion: deps.sesiones.leer(contextoId), envio: permiso.envio,
        });
        await correr(contextoId, args, persona, emitir);
        if (mezclar) await deps.sync.ahora(); // ver si quedó resuelto
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
