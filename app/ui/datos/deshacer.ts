import type { EventoChat, Puente } from "../../shared/puente";
import { crudos, cwdDe, relativa } from "./pasos";

const EDITAN = new Set(["Edit", "Write", "MultiEdit"]);
// Solo-agregar: nunca se editan hacia atrás.
const SOLO_AGREGAR = (r: string) => r.endsWith("linea-de-tiempo.md") || r.startsWith("sesiones/");
const NO_EXISTIA = /does not exist in|exists on disk, but not in/;

/** Archivos que Claude editó o creó en el turno (relativos al repo), sin los de solo-agregar. */
export function archivosADeshacer(eventos: EventoChat[]): string[] {
  const evs = crudos(eventos);
  const cwd = cwdDe(evs);
  const rutas = evs
    .filter((e) => e.type === "assistant")
    .flatMap((e) => ((e.message as { content?: unknown })?.content as Record<string, unknown>[] | undefined) ?? [])
    .filter((b) => b.type === "tool_use" && EDITAN.has(String(b.name)))
    .map((b) => (b.input as { file_path?: unknown } | undefined)?.file_path)
    .flatMap((r) => (typeof r === "string" ? [relativa(r, cwd)] : []))
    .filter((r): r is string => Boolean(r) && !SOLO_AGREGAR(r!));
  return [...new Set(rutas)];
}

type Aos = { repo: Pick<Puente["repo"], "write" | "delete">; git: Pick<Puente["git"], "show">; sync: Pick<Puente["sync"], "pausar" | "enCurso" | "ahora"> };

/** Deja `rutas` como estaban en `commitPrevio` (borra las que no existían) y commitea "app: deshacer <persona>". */
export async function deshacer(rutas: string[], commitPrevio: string, persona: string, aos: Aos = window.aos): Promise<void> {
  const reanudar = aos.sync.pausar();
  try {
    await aos.sync.enCurso();
    // Primero se leen todas: si git falla con una, no se toca ninguna (mejor nada que borrar de más).
    const previos = await Promise.all(rutas.map((ruta) => aos.git.show(commitPrevio, ruta).catch((e: unknown) => {
      if (NO_EXISTIA.test(String(e))) return null;
      throw e;
    })));
    for (const [k, ruta] of rutas.entries()) {
      const previo = previos[k];
      if (previo !== null) await aos.repo.write(ruta, previo);
      else await aos.repo.delete(ruta).catch(() => {}); // ya no está: nada que borrar
    }
    await aos.sync.ahora(`app: deshacer ${persona}`);
  } finally {
    reanudar();
  }
}
