import { useSyncExternalStore } from "react";
import type { EventoChat } from "../../shared/puente";
import { archivosADeshacer, deshacer } from "./deshacer";

export type Turno = { mensaje: string; eventos: EventoChat[]; enCurso: boolean };
/** Lo que Claude cambió y nadie ha aceptado ni deshecho: se acumula entre turnos hasta Aceptar o Deshacer todo. */
export type Revision = { commitPrevio: string; rutas: string[] };
export type Receta = { etiqueta: string; mensaje: string };

// Vive fuera de React: cerrar el panel no corta el turno ni borra la conversación (dura lo que la sesión de la app).
const conversaciones = new Map<string, Turno[]>();
let revision: Revision | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const VACIA: Turno[] = [];

function alEvento(id: string, e: EventoChat): void {
  const turnos = conversaciones.get(id);
  const t = turnos?.at(-1);
  if (!turnos || !t) return;
  const nuevo = { ...t, eventos: [...t.eventos, e], enCurso: t.enCurso && e.tipo !== "fin" };
  conversaciones.set(id, [...turnos.slice(0, -1), nuevo]);
  const previo = revision?.commitPrevio ?? nuevo.eventos.find((x) => x.tipo === "inicio")?.commitPrevio;
  const rutas = archivosADeshacer(nuevo.eventos);
  if (previo && rutas.length) revision = { commitPrevio: previo, rutas: [...new Set([...(revision?.rutas ?? []), ...rutas])] };
  avisar();
}

let quitar: (() => void) | null = null;
function suscribir(f: () => void): () => void {
  quitar ??= window.aos.claude.onEvento(alEvento);
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export const useConversacion = (id: string): Turno[] => useSyncExternalStore(suscribir, () => conversaciones.get(id) ?? VACIA);
export const useRevision = (): Revision | null => useSyncExternalStore(suscribir, () => revision);
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
  avisar();
}

export async function deshacerTodo(persona: string): Promise<void> {
  if (!revision) return;
  await deshacer(revision.rutas, revision.commitPrevio, persona);
  revision = null;
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
