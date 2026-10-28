import { type ReactNode, useEffect, useState } from "react";
import type { Config as ConfigLocal } from "../../shared/puente";
import { colorPara, horaDe, zonaActual } from "../datos/hoy";
import { cambiar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import { activar, leerSkills, type Skill } from "../datos/skills";
import "./pantallas.css";

const CONECTORES_URL = "https://claude.ai/settings/connectors";
const TAREAS_URL = "https://claude.ai/code/scheduled";
const DOC_TAREAS = "docs/tareas-programadas.md";
const AVISOS: { k: keyof ConfigLocal["avisos"]; nombre: string; detalle: string }[] = [
  { k: "reuniones", nombre: "Reuniones", detalle: "10 minutos antes de una reunión tuya" },
  { k: "actas", nombre: "Actas", detalle: "cuando queda el acta de una reunión donde estuviste" },
  { k: "dia", nombre: "Resumen del día", detalle: "cuando tu resumen de la mañana está listo" },
  { k: "menciones", nombre: "Menciones", detalle: "cuando alguien te menciona en un comentario" },
];
const abrir = (url: string) => void window.aos.sistema.abrir(url).catch(() => {});

function Seccion({ titulo, bajada, children }: { titulo: string; bajada?: string; children: ReactNode }) {
  return (
    <section className="conf-seccion" aria-label={titulo}>
      <h2>{titulo}</h2>
      {bajada && <p className="bajada">{bajada}</p>}
      {children}
    </section>
  );
}

export function Config({ onEditar, onCambiarPersona }: { onEditar: (ruta: string) => void; onCambiarPersona: () => void }) {
  return (
    <main className="principal conf">
      <h1 className="titulo">Configuración</h1>
      <TuEspacio onCambiarPersona={onCambiarPersona} />
      <Avisos />
      <Skills />
      <Conectores />
      <Seccion titulo="Tareas programadas" bajada="Las pasadas automáticas (recolectar, recurrentes) corren en claude.ai, no en esta compu.">
        <div className="acciones">
          <button className="btn" onClick={() => onEditar(DOC_TAREAS)}>Cómo se configuran</button>
          <button className="btn" onClick={() => abrir(TAREAS_URL)}>Abrir en claude.ai</button>
        </div>
      </Seccion>
    </main>
  );
}

function TuEspacio({ onCambiarPersona }: { onCambiarPersona: () => void }) {
  const { indice, persona } = useSesion();
  const [repo, setRepo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => void window.aos.config.leer().then((c) => setRepo(c.repo), () => {}), []);
  const yo = indice.personas.find((p) => p.slug === persona);
  return (
    <Seccion titulo="Tú y esta compu">
      <div className="conf-fila">
        <span className="av" style={{ background: colorPara(persona) }} aria-hidden>{(yo?.nombre ?? persona)[0]}</span>
        <span className="conf-t">{yo?.nombre ?? persona}<span className="sub">{yo?.rol ?? "Persona"}</span></span>
        <button className="btn" onClick={onCambiarPersona}>Cambiar persona</button>
      </div>
      <ZonaHoraria />
      <div className="conf-fila">
        <span className="conf-t">Carpeta del repo<span className="sub ruta">{repo ?? "…"}</span></span>
        <button className="btn" aria-expanded={confirmar} onClick={() => setConfirmar(true)}>Cambiar carpeta</button>
      </div>
      {confirmar && (
        <div className="formulario" role="alertdialog" aria-label="Confirmar cambio de carpeta"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setConfirmar(false); } }}>
          <span>La app se reinicia con la carpeta que elijas.</span>
          <button className="btn pri" autoFocus onClick={() => void window.aos.sistema.cambiarRepo().then(() => setConfirmar(false))}>Elegir carpeta</button>
          <button className="btn plano" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      )}
    </Seccion>
  );
}

const ZONAS = Intl.supportedValuesOf("timeZone");

/** Las horas se guardan en UTC; cada persona las ve en su zona (`zona_horaria` de su ficha). */
function ZonaHoraria() {
  const { indice, persona } = useSesion();
  const yo = indice.personas.find((p) => p.slug === persona);
  const [error, setError] = useState(false);
  if (!yo) return null;
  const cambiarZona = (z: string) => {
    setError(false);
    cambiar(yo.ruta, { zona_horaria: z }).catch(() => setError(true));
  };
  return (
    <div className="conf-fila">
      <label className="conf-t" htmlFor="zona">Zona horaria<span className="sub">Las horas de reuniones y avisos se muestran en esta zona. Ahora son las {horaDe(new Date().toISOString())}.</span></label>
      <select id="zona" className="conf-select" value={zonaActual()} onChange={(e) => cambiarZona(e.target.value)}>
        {ZONAS.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
      </select>
      {error && <p className="error" role="alert">No pude guardar la zona en tu ficha.</p>}
    </div>
  );
}

function Avisos() {
  const [avisos, setAvisos] = useState<ConfigLocal["avisos"] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => void window.aos.config.leer().then((c) => setAvisos(c.avisos), () => setError(true)), []);
  const cambiar = (k: keyof ConfigLocal["avisos"], on: boolean) => {
    if (!avisos) return;
    const nuevos = { ...avisos, [k]: on };
    setAvisos(nuevos);
    window.aos.config.guardar({ avisos: nuevos }).catch(() => { setAvisos(avisos); setError(true); });
  };
  return (
    <Seccion titulo="Avisos" bajada="Solo en esta compu. Puedes pausarlos una hora desde la barra de menú.">
      {avisos && AVISOS.map((a) => (
        <label key={a.k} className="conf-fila interruptor">
          <span className="conf-t">{a.nombre}<span className="sub">{a.detalle}</span></span>
          <span className="estado-txt" aria-hidden>{avisos[a.k] ? "Activo" : "Apagado"}</span>
          <input type="checkbox" role="switch" checked={avisos[a.k]} onChange={(e) => cambiar(a.k, e.target.checked)} />
        </label>
      ))}
      {error && <p className="error" role="alert">No se pudo leer o guardar la configuración de avisos.</p>}
    </Seccion>
  );
}

function Skills() {
  const [lista, setLista] = useState<Skill[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const leer = () => leerSkills().then(setLista, () => setError("No pude leer las skills."));
  useEffect(() => void leer(), []);
  const activarla = (s: Skill) => {
    setError(null);
    activar(s).then(leer, () => setError(`No pude activar ${s.nombre}. Puede que ya exista una skill con ese nombre.`));
  };
  const busca = q.trim().toLowerCase();
  const calza = (s: Skill) => !busca || `${s.nombre} ${s.descripcion}`.toLowerCase().includes(busca);
  const activas = lista?.filter((s) => s.activa && calza(s)) ?? [];
  const biblioteca = lista?.filter((s) => !s.activa && calza(s)) ?? [];
  return (
    <Seccion titulo="Skills" bajada="Las activas las usa Claude con todo el equipo. Activar una de la biblioteca la mueve a .claude/skills.">
      <label className="oculto" htmlFor="buscar-skill">Buscar skill</label>
      <input id="buscar-skill" className="conf-buscar" type="search" placeholder="Buscar skill…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error" role="alert">{error}</p>}
      {lista === null ? <p className="vacio">Leyendo skills…</p> : (
        <>
          <h3 className="subtitulo">Activas <span className="c">{activas.length}</span></h3>
          <ul className="skills">{activas.map((s) => <FilaSkill key={s.ruta} s={s} />)}</ul>
          <h3 className="subtitulo">Biblioteca <span className="c">{biblioteca.length}</span></h3>
          {biblioteca.length === 0 && <p className="vacio">{busca ? "Nada calza en la biblioteca." : "La biblioteca está vacía."}</p>}
          <ul className="skills">{biblioteca.map((s) => <FilaSkill key={s.ruta} s={s} onActivar={() => activarla(s)} />)}</ul>
        </>
      )}
    </Seccion>
  );
}

function FilaSkill({ s, onActivar }: { s: Skill; onActivar?: () => void }) {
  return (
    <li className="skill">
      <span className="conf-t">
        <span className="skill-nombre">{s.activa && <span className="ok" aria-hidden>● </span>}{s.nombre}</span>
        {s.descripcion && <span className="sub skill-desc" title={s.descripcion}>{s.descripcion}</span>}
      </span>
      {onActivar && <button className="btn" onClick={onActivar} aria-label={`Activar ${s.nombre}`}>Activar</button>}
    </li>
  );
}

function Conectores() {
  const [salida, setSalida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revisar = () => {
    setSalida(null);
    setError(null);
    window.aos.sistema.conectores().then(setSalida, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(revisar, []);
  return (
    <Seccion titulo="Conectores" bajada="Gmail, Calendar, Drive, Instagram… se conectan en claude.ai y Claude los usa desde aquí.">
      <div className="acciones">
        <button className="btn pri" onClick={() => abrir(CONECTORES_URL)}>Abrir claude.ai → Connectors</button>
        <button className="btn" onClick={() => (salida !== null || error) && revisar()} aria-disabled={salida === null && !error}>Revisar de nuevo</button>
      </div>
      {salida === null && !error && <p className="vacio" role="status">Revisando conectores…</p>}
      {error && <p className="error" role="alert">⚠ {error}</p>}
      {salida !== null && <pre className="conf-salida" tabIndex={0} aria-label="Conectores de Claude Code">{salida || "No hay conectores."}</pre>}
    </Seccion>
  );
}
