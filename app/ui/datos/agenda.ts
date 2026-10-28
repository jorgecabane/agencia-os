import type { Aviso } from "../../shared/puente";
import { diaDe, fechaLocal, horaDe, hoy, titulo } from "./hoy";
import type { Indice } from "./indice";
import type { Entregable, Reunion } from "./tipos";

const MIN_MS = 60_000;
const AVISO_REUNION_MIN = 10;
const SIGUE_PROXIMA_MIN = 10; // una reunión que ya empezó sigue como "próxima" (con "Unirme") estos minutos
// Nunca a `publicado`: marcar algo como publicado es decir que salió hacia afuera (ruling R17).
const SIGUIENTE: Record<string, string> = { brief: "en_curso", en_curso: "revision", revision: "aprobado" };
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const conHora = (r: Reunion) => String(r.fecha).length > 10;
const inicio = (r: Reunion) => new Date(String(r.fecha)).getTime();

/** La casilla "listo" de la barra: brief → en_curso → revision → aprobado; aprobado, publicado y cancelado quedan. */
export const siguienteEstado = (e: Pick<Entregable, "estado">): string => SIGUIENTE[e.estado] ?? e.estado;

/** "En 8 minutos", "En 1 minuto", "Ahora" o, a más de una hora, "A las 18:30". */
export function cuentaRegresiva(fecha: string, ahora: Date): string {
  const min = Math.round((new Date(fecha).getTime() - ahora.getTime()) / MIN_MS);
  if (min <= 0) return "Ahora";
  if (min < 60) return `En ${plural(min, "minuto", "minutos")}`;
  return `A las ${horaDe(fecha)}`;
}

/** Lo que muestra la barra de menú: próxima reunión, el resto del día y mis entregas (vencen hoy o antes). */
export function agenda(i: Indice, persona: string, ahora: Date): {
  proxima?: Reunion; masTarde: Reunion[]; entregas: Entregable[]; pendientes: number; atrasado: boolean;
} {
  const fecha = fechaLocal(ahora);
  const h = hoy(i, persona, fecha);
  const t = ahora.getTime();
  // Próxima: la que empezó hace menos de 10 min (la última, si hay varias) o la primera que viene.
  const candidatas = h.reuniones.filter((r) => conHora(r) && t - inicio(r) < SIGUE_PROXIMA_MIN * MIN_MS);
  const proxima = candidatas.filter((r) => inicio(r) <= t).at(-1) ?? candidatas[0];
  return {
    proxima,
    // Las sin hora quedan en "más tarde"; las que ya empezaron salen.
    masTarde: h.reuniones.filter((r) => r !== proxima && (!conHora(r) || inicio(r) > t)),
    entregas: h.entregas,
    pendientes: h.entregas.length,
    atrasado: h.entregas.some((e) => String(e.vence) < fecha),
  };
}

export const nombreCliente = (i: Indice, slug: string): string => i.clientes.find((c) => c.slug === slug)?.nombre ?? slug;

function avisoReunion(i: Indice, r: Reunion, ahora: Date): Aviso {
  const brief = r.tipo === "brief-reunion";
  return {
    id: `reunion:${r.ruta}`, ruta: r.ruta,
    titulo: `${nombreCliente(i, r.cliente)} ${cuentaRegresiva(r.fecha, ahora).toLowerCase()}`,
    texto: brief ? `Brief listo: ${titulo(r.ruta)}.` : titulo(r.ruta),
  };
}

function avisoActa(i: Indice, r: Reunion, persona: string): Aviso {
  const enlace = `[[${r.ruta.replace(/\.md$/, "")}]]`;
  const tareas = i.entregables.filter((e) => String(e.origen ?? "").includes(enlace));
  const mias = tareas.filter((e) => e.responsable === persona).length;
  return {
    id: `acta:${r.ruta}`, ruta: r.ruta,
    titulo: `Acta lista: ${titulo(r.ruta)} · ${nombreCliente(i, r.cliente)}`,
    texto: tareas.length ? `${plural(tareas.length, "tarea nueva", "tareas nuevas")} (${mias} para ti). Revísalas.` : "Revisa lo que quedó.",
  };
}

/**
 * Avisos del sistema por mostrar: reunión mía en ≤ 10 min, acta de hoy o ayer donde soy asistente y el resumen
 * del día cuando aparece mi `bandeja/<hoy>-hoy-<persona>.md` (`bandejas` = rutas de `bandeja/*.md`).
 */
export function avisosPendientes(i: Indice, persona: string, ahora: Date, yaAvisados: Set<string>, bandejas: string[] = []): Aviso[] {
  const fecha = fechaLocal(ahora);
  const ayer = fechaLocal(new Date(ahora.getTime() - 86_400_000));
  const h = hoy(i, persona, fecha);
  const pronto = h.reuniones.filter((r) => conHora(r) && inicio(r) >= ahora.getTime() && inicio(r) - ahora.getTime() <= AVISO_REUNION_MIN * MIN_MS);
  const actas = i.reuniones.filter((r) => r.tipo === "reunion" && (r.asistentes ?? []).includes(persona) && diaDe(r.fecha) >= ayer);
  const avisos = [...pronto.map((r) => avisoReunion(i, r, ahora)), ...actas.map((r) => avisoActa(i, r, persona))];
  const bandeja = `bandeja/${fecha}-hoy-${persona}.md`;
  if (bandejas.includes(bandeja)) {
    const reuniones = new Set(h.reuniones.map((r) => String(r.fecha))).size; // brief y acta de una misma reunión cuentan una vez
    avisos.push({
      id: `dia:${fecha}`, ruta: bandeja, texto: "Tu resumen de hoy está listo.",
      titulo: `Tu día: ${plural(h.entregas.length, "entrega", "entregas")}, ${plural(reuniones, "reunión", "reuniones")}`,
    });
  }
  return avisos.filter((a) => !yaAvisados.has(a.id));
}
