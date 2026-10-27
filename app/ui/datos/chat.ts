import { useSyncExternalStore } from "react";
import type { EventoChat } from "../../shared/puente";
import { archivosADeshacer, deshacer } from "./deshacer";

export type Turno = { mensaje: string; eventos: EventoChat[]; enCurso: boolean };
/**
 * Lo que Claude cambió y nadie ha aceptado ni deshecho, acumulado entre turnos hasta Aceptar o Deshacer todo:
 * cada ruta con su base (HEAD antes del primer turno que la tocó).
 */
export type Revision = { archivos: Record<string, string> };
export type Receta = { etiqueta: string; mensaje: string };

// Vive fuera de React: cerrar el panel no corta el turno ni borra la conversación (dura lo que la sesión de la app).
const conversaciones = new Map<string, Turno[]>();
let revision: Revision | null = null;
let previas: Record<string, string> = {}; // archivos de turnos ya terminados, con su base (sin aceptar ni deshacer)
let omitidos: string[] = []; // del último Deshacer: lo que otra persona cambió después y no se pisó
const SIN_OMITIDOS: string[] = [];
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const VACIA: Turno[] = [];

/** Archivos del turno, recalculados con todos sus eventos (un Edit que después falla sale); los de turnos previos mandan. */
function recalcular(t: Turno): void {
  const base = t.eventos.find((x) => x.tipo === "inicio")?.commitPrevio;
  const delTurno = base ? Object.fromEntries(archivosADeshacer(t.eventos).map((r) => [r, base])) : {};
  const archivos = { ...delTurno, ...previas };
  if (!t.enCurso) previas = archivos;
  revision = Object.keys(archivos).length ? { archivos } : null;
}

export function alEvento(id: string, e: EventoChat): void {
  const turnos = conversaciones.get(id);
  const t = turnos?.at(-1);
  if (!turnos || !t) return;
  const nuevo = { ...t, eventos: [...t.eventos, e], enCurso: t.enCurso && e.tipo !== "fin" };
  conversaciones.set(id, [...turnos.slice(0, -1), nuevo]);
  recalcular(nuevo);
  avisar();
}

export const leerRevision = () => revision;

let quitar: (() => void) | null = null;
function suscribir(f: () => void): () => void {
  quitar ??= window.aos.claude.onEvento(alEvento);
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export const useConversacion = (id: string): Turno[] => useSyncExternalStore(suscribir, () => conversaciones.get(id) ?? VACIA);
export const useRevision = (): Revision | null => useSyncExternalStore(suscribir, () => revision);
export const useOmitidos = (): string[] => useSyncExternalStore(suscribir, () => (omitidos.length ? omitidos : SIN_OMITIDOS));
export const olvidarOmitidos = () => { omitidos = []; avisar(); };
const algunoEnCurso = () => [...conversaciones.values()].some((ts) => ts.at(-1)?.enCurso);
export const useAlgunoEnCurso = (): boolean => useSyncExternalStore(suscribir, algunoEnCurso);

export function enviar(id: string, mensaje: string, contexto: string, envio?: string[]): void {
  quitar ??= window.aos.claude.onEvento(alEvento);
  conversaciones.set(id, [...(conversaciones.get(id) ?? []), { mensaje, eventos: [], enCurso: true }]);
  avisar();
  window.aos.claude.enviar(id, mensaje, contexto, envio).catch((e: unknown) => {
    alEvento(id, { tipo: "error", texto: `No pude hablar con Claude: ${e instanceof Error ? e.message : String(e)}` });
    alEvento(id, { tipo: "fin" });
  });
}

export const cancelar = (id: string) => window.aos.claude.cancelar(id);

export function aceptar(): void {
  revision = null;
  previas = {};
  avisar();
}

export async function deshacerTodo(persona: string): Promise<void> {
  if (!revision) return;
  omitidos = (await deshacer(revision.archivos, persona)).omitidos;
  revision = null;
  previas = {};
  avisar();
}

const SKILLS_POR_FORMATO: [RegExp, string[]][] = [
  [/reel|video/, ["ig-reel"]], [/carrusel|post/, ["ig-carousel", "ig-caption"]], [/story/, ["ig-story"]],
  [/email|correo|newsletter/, ["emails"]], [/ads?\b|anuncio/, ["ad-creative"]],
];
const skill = (s: string): Receta => ({ etiqueta: s, mensaje: `Usa la skill ${s} para esto.` });
const corta = (etiqueta: string, mensaje = etiqueta): Receta => ({ etiqueta, mensaje });

/** Atajos según dónde se abre el chat: skills que calzan y acciones cortas. */
export function recetas(contexto: string, formato?: string): Receta[] {
  if (formato) {
    const skills = SKILLS_POR_FORMATO.find(([re]) => re.test(formato))?.[1] ?? [];
    return [corta("Más corto", "Hazlo más corto."), corta("Otra versión", "Dame otra versión."), ...skills.map(skill)];
  }
  if (/^clientes\/[^/]+$/.test(contexto)) {
    return [corta("¿Cómo vamos?", "¿Cómo vamos con este cliente? Resume lo abierto y lo atrasado."), corta("Ideas de contenido", "Proponme ideas de contenido para este cliente."), skill("content-strategy")];
  }
  if (contexto.endsWith(".md")) return [corta("Más corto", "Hazlo más corto."), corta("Revisa la redacción", "Revisa la redacción de este documento."), skill("copy-editing")];
  return [corta("¿Qué vence esta semana?"), corta("¿Qué adelanto hoy?", "¿Qué me conviene adelantar hoy?"), skill("brief-del-dia")];
}
