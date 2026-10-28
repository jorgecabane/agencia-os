import { CalendarDays, Inbox, Search, Settings, Sparkles, SquareKanban, Sun, TriangleAlert } from "lucide-react";
import { colorPara, hoy } from "../datos/hoy";
import { useSesion } from "../datos/sesion";
import { IndicadorSync } from "./IndicadorSync";
import "./lateral.css";

type Principal =
  | { nombre: "hoy" } | { nombre: "tablero" } | { nombre: "cliente"; slug: string } | { nombre: "calendario" }
  | { nombre: "aprobaciones"; ruta?: string } | { nombre: "config" }
  | { nombre: "claude"; id?: string } | { nombre: "equipo" } | { nombre: "revisar"; ruta: string };
export type Pantalla = Principal | { nombre: "editar"; ruta: string; desde: Principal };

export const ICONO = 16;

/** Barra lateral común. "Claude ⌘J" abre o cierra el chat de la derecha; `onBuscar` (⌘K) llega con la paleta. */
export function Lateral({ pantalla, ir, fecha, onCambiarPersona, onMezclar, onBuscar, onClaude }: {
  pantalla: Pantalla; ir: (p: Pantalla) => void; fecha: string; onCambiarPersona: () => void; onMezclar: () => void;
  onBuscar?: () => void; onClaude: () => void;
}) {
  const { indice, persona } = useSesion();
  const h = hoy(indice, persona, fecha);
  const yo = indice.personas.find((p) => p.slug === persona);
  const { rotos } = indice;
  const porAprobar = indice.aprobaciones.filter((a) => a.persona === persona && a.estado === "pendiente").length;
  const actual = (nombre: Pantalla["nombre"]) => (pantalla.nombre === nombre ? "page" : undefined);
  return (
    <nav className="lateral" aria-label="Secciones">
      {onBuscar && (
        <button className="buscar" onClick={onBuscar}>
          <Search size={ICONO} aria-hidden />Buscar o crear…<kbd className="atajo">⌘K</kbd>
        </button>
      )}
      <button className="nav-it" aria-current={pantalla.nombre === "hoy" ? "page" : undefined} onClick={() => ir({ nombre: "hoy" })}>
        <Sun size={ICONO} aria-hidden />Hoy<span className="n">{h.entregas.length + h.reuniones.length}</span>
      </button>
      <button className="nav-it" aria-current={pantalla.nombre === "tablero" ? "page" : undefined} onClick={() => ir({ nombre: "tablero" })}>
        <SquareKanban size={ICONO} aria-hidden />Tablero
      </button>
      <button className="nav-it" aria-current={actual("calendario")} onClick={() => ir({ nombre: "calendario" })}>
        <CalendarDays size={ICONO} aria-hidden />Calendario
      </button>
      <button className="nav-it" aria-current={actual("aprobaciones")} onClick={() => ir({ nombre: "aprobaciones" })}>
        <Inbox size={ICONO} aria-hidden />Aprobaciones
        {porAprobar > 0 && <span className="n" aria-label={`${porAprobar} tuyas por revisar`}>{porAprobar}</span>}
      </button>
      <button className="nav-it" aria-current={actual("claude")} onClick={onClaude}>
        <Sparkles size={ICONO} className="chispa" aria-hidden />Claude<kbd className="atajo">⌘J</kbd>
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
            <summary><TriangleAlert size={14} aria-hidden /> {rotos.length === 1 ? "1 archivo con problemas" : `${rotos.length} archivos con problemas`}</summary>
            <ul>{rotos.map((r) => <li key={r.ruta + r.error}>{r.ruta}: {r.error}</li>)}</ul>
          </details>
        )}
        <IndicadorSync onMezclar={onMezclar} />
        <button className="nav-it" aria-current={actual("config")} onClick={() => ir({ nombre: "config" })}>
          <Settings size={ICONO} aria-hidden />Configuración
        </button>
        <button className="nav-it" onClick={onCambiarPersona} title="Cambiar de persona">
          <span className="av" style={{ background: colorPara(persona) }} aria-hidden>{(yo?.nombre ?? persona)[0]}</span>
          {yo?.nombre ?? persona}<span className="n">cambiar</span>
        </button>
      </div>
    </nav>
  );
}
