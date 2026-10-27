import { colorPara, hoy } from "../datos/hoy";
import { useSesion } from "../datos/sesion";
import { IndicadorSync } from "./IndicadorSync";

type Principal = { nombre: "hoy" } | { nombre: "tablero" } | { nombre: "cliente"; slug: string };
export type Pantalla = Principal | { nombre: "editar"; ruta: string; desde: Principal };

/** Barra lateral común. Las demás pantallas se suman aquí cuando existan. */
export function Lateral({ pantalla, ir, fecha, onCambiarPersona }: {
  pantalla: Pantalla; ir: (p: Pantalla) => void; fecha: string; onCambiarPersona: () => void;
}) {
  const { indice, persona } = useSesion();
  const h = hoy(indice, persona, fecha);
  const yo = indice.personas.find((p) => p.slug === persona);
  const { rotos } = indice;
  return (
    <nav className="lateral" aria-label="Secciones">
      <button className="nav-it" aria-current={pantalla.nombre === "hoy" ? "page" : undefined} onClick={() => ir({ nombre: "hoy" })}>
        <span aria-hidden>◉</span>Hoy<span className="n">{h.entregas.length + h.reuniones.length}</span>
      </button>
      <button className="nav-it" aria-current={pantalla.nombre === "tablero" ? "page" : undefined} onClick={() => ir({ nombre: "tablero" })}>
        <span aria-hidden>▦</span>Tablero
      </button>
      <div className="grupo">Clientes</div>
      {indice.clientes.map((c) => (
        <button
          className="nav-it" key={c.slug} onClick={() => ir({ nombre: "cliente", slug: c.slug })}
          aria-current={pantalla.nombre === "cliente" && pantalla.slug === c.slug ? "page" : undefined}
        >
          <span className="dot" style={{ background: colorPara(c.slug) }} aria-hidden />{c.nombre}
        </button>
      ))}
      <div className="pie">
        {rotos.length > 0 && (
          <details className="rotos">
            <summary>⚠ {rotos.length === 1 ? "1 archivo con problemas" : `${rotos.length} archivos con problemas`}</summary>
            <ul>{rotos.map((r) => <li key={r.ruta + r.error}>{r.ruta}: {r.error}</li>)}</ul>
          </details>
        )}
        <IndicadorSync />
        <button className="nav-it" onClick={onCambiarPersona} title="Cambiar de persona">
          <span className="av" style={{ background: colorPara(persona) }} aria-hidden>{(yo?.nombre ?? persona)[0]}</span>
          {yo?.nombre ?? persona}<span className="n">cambiar</span>
        </button>
      </div>
    </nav>
  );
}
