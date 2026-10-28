import { diaDe } from "./hoy";
import type { Indice } from "./indice";
import { cambiar } from "./md";
import type { Decision, Entregable, Reunion } from "./tipos";

const VENTANA_DIAS = 14;
const DIA_MS = 86_400_000;

/** Actas sin revisar de los últimos 14 días donde `persona` estuvo o cuyo cliente lleva; la más nueva primero. */
export function porRevisar(i: Indice, persona: string, hoy: string): Reunion[] {
  const desde = new Date(Date.parse(`${hoy}T00:00Z`) - VENTANA_DIAS * DIA_MS).toISOString().slice(0, 10);
  const misClientes = new Set(i.clientes.filter((c) => c.responsable === persona).map((c) => c.slug));
  return i.reuniones
    .filter((r) => r.tipo === "reunion" && !r.revisada)
    .filter((r) => (r.asistentes ?? []).includes(persona) || misClientes.has(r.cliente))
    .filter((r) => { const d = diaDe(r.fecha); return d >= desde && d <= hoy; })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** Entregables y decisiones cuyo `origen` apunta a esta acta. */
export function deActa(i: Indice, acta: Reunion): { tareas: Entregable[]; decisiones: Decision[] } {
  const enlace = `[[${acta.ruta.replace(/\.md$/, "")}]]`;
  const de = (x: { origen?: string }) => String(x.origen ?? "").includes(enlace);
  return { tareas: i.entregables.filter(de), decisiones: i.decisiones.filter(de) };
}

/** Cancela las tareas destildadas y marca el acta como revisada. */
export async function confirmarActa(acta: Reunion, descartadas: string[]): Promise<void> {
  for (const r of descartadas) await cambiar(r, { estado: "cancelado" });
  await cambiar(acta.ruta, { revisada: true });
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
/** "2 decisiones y 3 tareas nuevas por confirmar"; sin la parte que es cero. */
export function porConfirmar(decisiones: number, tareas: number): string {
  const partes = [decisiones && plural(decisiones, "decisión", "decisiones"), tareas && plural(tareas, "tarea nueva", "tareas nuevas")].filter(Boolean);
  return partes.length ? `${partes.join(" y ")} por confirmar` : "Sin tareas nuevas: márcala como revisada";
}
