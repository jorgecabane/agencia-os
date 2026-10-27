import type { EventoChat } from "../../shared/puente";
import { titulo } from "./hoy";

export type Estado = "ok" | "corriendo" | "error";
export type Paso = { id: string; texto: string; estado: Estado };
export type Bloque = { tipo: "pasos"; pasos: Paso[] } | { tipo: "texto"; texto: string } | { tipo: "aprobacion"; ruta: string };
type Uso = { name: string; input: Record<string, unknown> };
type Resultado = { error: boolean; rechazado: boolean };
type Contenido = { type?: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string; tool_use_id?: string; is_error?: boolean; content?: unknown };

const EDITAN = new Set(["Edit", "Write", "MultiEdit"]);
const RECHAZO = /requires approval|requested permissions|haven't granted/i;
const APROBACION = /^bandeja\/[^/]*aprobacion[^/]*\.md$/;
const DOCS: Record<string, string> = {
  brandbook: "el brandbook", contexto: "el contexto", "plan-contratado": "el plan contratado", material: "el material",
  _ficha: "la ficha", "linea-de-tiempo": "la línea de tiempo",
};

/** Ruta absoluta que usa Claude → relativa al repo (`cwd` del evento init); null si queda fuera. */
export function relativa(ruta: string, cwd?: string): string | null {
  if (!cwd) return ruta.startsWith("/") ? null : ruta;
  const base = cwd.endsWith("/") ? cwd : `${cwd}/`;
  return ruta.startsWith(base) ? ruta.slice(base.length) : null;
}

const nombreDoc = (ruta: string) => DOCS[(ruta.split("/").pop() ?? "").replace(/\.md$/, "")] ?? titulo(ruta);

/** Lo que hizo una herramienta, en palabras de persona. Sin resultado todavía: "corriendo". */
export function paso(uso: Uso, resultado?: Resultado, cwd?: string): { texto: string; estado: Estado } {
  const { name, input } = uso;
  if (resultado?.rechazado) {
    const cmd = name === "Bash" && typeof input.command === "string" ? `(${input.command})` : "";
    return { texto: `No tengo permiso para ${name}${cmd}`, estado: "error" };
  }
  const ruta = typeof input.file_path === "string" ? relativa(input.file_path, cwd) ?? input.file_path : "";
  const servidor = /^mcp__claude_ai_(.+)__/.exec(name)?.[1]?.replace(/_/g, " ");
  const texto =
    name === "Read" ? `Leí ${nombreDoc(ruta)}`
    : EDITAN.has(name) ? `Edité ${titulo(ruta)}`
    : name === "Skill" ? `Usando ${String(input.skill ?? input.command ?? "una skill")}`
    : name === "Glob" || name === "Grep" ? "Busqué en el repo"
    : name === "Bash" ? "Corrí un comando"
    : servidor ? `Consulté ${servidor}`
    : `Usé ${name}`;
  return { texto, estado: !resultado ? "corriendo" : resultado.error ? "error" : "ok" };
}

const bloquesDe = (ev: Record<string, unknown>): Contenido[] => {
  const c = (ev.message as { content?: unknown } | undefined)?.content;
  return Array.isArray(c) ? c : [];
};

/** Resultado de cada herramienta por id; rechazada si el meta dice "reject" o el texto lo dice. */
function resultados(eventos: Record<string, unknown>[]): Map<string, Resultado> {
  const r = new Map<string, Resultado>();
  for (const ev of eventos.filter((e) => e.type === "user")) {
    const metas = Array.isArray(ev.tool_result_meta) ? ev.tool_result_meta as { id?: string; permission_decision?: { decision?: string } }[] : [];
    for (const b of bloquesDe(ev).filter((x) => x.type === "tool_result" && x.tool_use_id)) {
      const meta = metas.some((m) => m.id === b.tool_use_id && m.permission_decision?.decision === "reject");
      const error = Boolean(b.is_error);
      r.set(b.tool_use_id!, { error, rechazado: meta || (error && RECHAZO.test(String(b.content ?? ""))) });
    }
  }
  return r;
}

export const crudos = (eventos: EventoChat[]) => eventos.flatMap((e) => (e.tipo === "evento" ? [e.evento] : []));
export const cwdDe = (evs: Record<string, unknown>[]) =>
  evs.find((e) => e.type === "system" && e.subtype === "init")?.cwd as string | undefined;

/** Un turno como lo muestra el chat: textos, grupos de pasos y tarjetas de aprobación, en orden. */
export function bloques(eventos: EventoChat[]): Bloque[] {
  const evs = crudos(eventos);
  const cwd = cwdDe(evs);
  const res = resultados(evs);
  const salida: Bloque[] = [];
  const aprobaciones = new Set<string>();
  for (const b of evs.filter((e) => e.type === "assistant").flatMap(bloquesDe)) {
    if (b.type === "text" && b.text?.trim()) salida.push({ tipo: "texto", texto: b.text.trim() });
    if (b.type !== "tool_use" || !b.id || !b.name) continue;
    const uso = { name: b.name, input: b.input ?? {} };
    const ultimo = salida.at(-1);
    const p = { id: b.id, ...paso(uso, res.get(b.id), cwd) };
    if (ultimo?.tipo === "pasos") ultimo.pasos.push(p);
    else salida.push({ tipo: "pasos", pasos: [p] });
    const ruta = typeof uso.input.file_path === "string" ? relativa(uso.input.file_path, cwd) : null;
    if (EDITAN.has(uso.name) && ruta && APROBACION.test(ruta) && !aprobaciones.has(ruta)) aprobaciones.add(ruta);
  }
  return [...salida, ...[...aprobaciones].map((ruta) => ({ tipo: "aprobacion" as const, ruta }))];
}
