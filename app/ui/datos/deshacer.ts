import type { EventoChat, Puente } from "../../shared/puente";
import { crudos, cwdDe, relativa, resultados } from "./pasos";

const EDITAN = new Set(["Edit", "Write", "MultiEdit"]);
// Solo-agregar: nunca se editan hacia atrás.
const SOLO_AGREGAR = (r: string) => r.endsWith("linea-de-tiempo.md") || r.startsWith("sesiones/");
const NO_EXISTIA = /does not exist in|exists on disk, but not in/;

/** Archivos que Claude editó o creó en el turno (relativos al repo), sin los de solo-agregar ni los que fallaron. */
export function archivosADeshacer(eventos: EventoChat[]): string[] {
  const evs = crudos(eventos);
  const cwd = cwdDe(evs);
  const res = resultados(evs);
  const rutas = evs
    .filter((e) => e.type === "assistant")
    .flatMap((e) => ((e.message as { content?: unknown })?.content as Record<string, unknown>[] | undefined) ?? [])
    .filter((b) => b.type === "tool_use" && EDITAN.has(String(b.name)) && !res.get(String(b.id))?.error)
    .map((b) => (b.input as { file_path?: unknown } | undefined)?.file_path)
    .flatMap((r) => (typeof r === "string" ? [relativa(r, cwd)] : []))
    .filter((r): r is string => Boolean(r) && !SOLO_AGREGAR(r!));
  return [...new Set(rutas)];
}

/** Commits de esta persona: los de la app y los de sus sesiones con Claude (hook Stop: "sesión: <persona> …"). */
const propio = (mensaje: string, persona: string) =>
  [`app: ${persona} `, `app: deshacer ${persona}`, `sesión: ${persona} `].some((p) => mensaje.startsWith(p));

type Aos = {
  repo: Pick<Puente["repo"], "write" | "delete">; git: Pick<Puente["git"], "show" | "log">;
  sync: Pick<Puente["sync"], "pausar" | "enCurso" | "ahora">;
};

/**
 * Deja cada archivo como estaba en su base (el commit previo al primer turno que lo tocó; borra los que no existían)
 * y commitea "app: deshacer <persona>". Lo que otra persona cambió después de esa base no se pisa: vuelve en `omitidos`.
 */
export async function deshacer(archivos: Record<string, string>, persona: string, aos: Aos = window.aos): Promise<{ omitidos: string[] }> {
  const reanudar = aos.sync.pausar();
  try {
    await aos.sync.enCurso();
    const entradas = Object.entries(archivos);
    const ajenos = await Promise.all(entradas.map(async ([ruta, base]) =>
      (await aos.git.log({ desde: base, ruta })).some((c) => !propio(c.mensaje, persona))));
    const omitidos = entradas.filter((_, k) => ajenos[k]).map(([ruta]) => ruta);
    const aRestaurar = entradas.filter((_, k) => !ajenos[k]);
    // Primero se leen todas: si git falla con una, no se toca ninguna (mejor nada que borrar de más).
    const previos = await Promise.all(aRestaurar.map(([ruta, base]) => aos.git.show(base, ruta).catch((e: unknown) => {
      if (NO_EXISTIA.test(String(e))) return null;
      throw e;
    })));
    for (const [k, [ruta]] of aRestaurar.entries()) {
      const previo = previos[k];
      if (previo !== null) await aos.repo.write(ruta, previo);
      else await aos.repo.delete(ruta).catch(() => {}); // ya no está: nada que borrar
    }
    if (aRestaurar.length) await aos.sync.ahora(`app: deshacer ${persona}`);
    return { omitidos };
  } finally {
    reanudar();
  }
}
