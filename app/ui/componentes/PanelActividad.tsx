import type { Commit } from "../../shared/puente";
import { hace, historial } from "../datos/actividad";
import { colorPara, zonaActual } from "../datos/hoy";
import { useSesion } from "../datos/sesion";

const corta = (f: string) =>
  new Date(f).toLocaleString("es-CL", { timeZone: zonaActual(), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Pestaña Actividad del panel: lo que pasó con la tarea según git, del más nuevo al más viejo. */
export function PanelActividad({ commits, onVerCambios }: { commits: Commit[] | null; onVerCambios: () => void }) {
  const { indice } = useSesion();
  if (commits === null) return null;
  if (commits.length === 0) return <p className="vacio">Aún no hay cambios guardados de esta tarea.</p>;
  const slug = (quien: string) => indice.personas.find((p) => p.nombre === quien)?.slug ?? quien.toLowerCase();
  return (
    <>
      <ul className="linea-act">
        {historial(commits, indice.personas).map((h, k) => (
          <li key={`${h.fecha}-${k}`}>
            <span className="av" style={{ background: colorPara(slug(h.quien)) }} aria-hidden>{h.quien[0]}</span>
            <span>
              <span className="q">{h.quien}</span> <span className="d">{h.texto}</span>
              <span className="cuando">{hace(h.fecha, new Date())} · {corta(h.fecha)}</span>
            </span>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={onVerCambios}>Ver cambios</button>
    </>
  );
}
