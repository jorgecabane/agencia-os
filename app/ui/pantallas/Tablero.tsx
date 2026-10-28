import { Plus } from "lucide-react";
import {
  type CSSProperties, type DragEvent, type FormEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState,
} from "react";
import type { Commit } from "../../shared/puente";
import { colorPersona, etiquetaEstado, Filtros } from "../componentes/Filtros";
import { ICONO as TAM } from "../componentes/Lateral";
import { MenuTarea } from "../componentes/MenuTarea";
import { NuevaTarea } from "../componentes/NuevaTarea";
import { ANILLO, Panel } from "../componentes/Panel";
import { actividad, autor, useUltimosCommits } from "../datos/actividad";
import { colorEtiqueta } from "../datos/etiquetas";
import { aplicar, ESTADOS } from "../datos/filtros";
import { colorPara, cuando, titulo } from "../datos/hoy";
import { cambiar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import type { Entregable } from "../datos/tipos";
import { ERROR_VISTAS, guardarVistas, igual, leerVistas, POR_DEFECTO, RUTA_VISTAS, type Vista } from "../datos/vistas";
import "./tablero.css";

type Actual = Omit<Vista, "nombre">;
const ICONO = { avanzo: "●", quieta: "▲", "sin-abrir": "◌" } as const;
// La tarjeta cambia de columna y React la vuelve a montar: el foco la sigue.
const seguirFoco = (ruta: string) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-ruta="${CSS.escape(ruta)}"] .puntos`)?.focus());
const plural = (n: number) => `${n} ${n === 1 ? "tarea" : "tareas"}`;
const MAX_ETIQUETAS = 3;
// Las etiquetas son listas: se comparan por contenido.
const igualValor = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Vistas guardadas del equipo (`app/vistas.json`), releídas si alguien las cambia. Si no se pueden leer: null y el error. */
export function useVistas(): [Vista[] | null, (vs: Vista[]) => Promise<void>, string | null] {
  const [vistas, setVistas] = useState<Vista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => void leerVistas().then(
      (v) => { if (vivo) { setVistas(v); setError(null); } },
      () => { if (vivo) { setVistas(null); setError(ERROR_VISTAS); } },
    );
    leer();
    const quitar = window.aos.repo.onCambio((rutas) => rutas.includes(RUTA_VISTAS) && leer());
    return () => { vivo = false; quitar(); };
  }, []);
  const guardar = async (vs: Vista[]) => { await guardarVistas(vs); setVistas(vs); };
  return [vistas, guardar, error]; // null = aún leyendo o ilegible
}

/** Cambios recién hechos en el tablero, encima del índice hasta que el índice los refleje. */
export function useMovidos(onError: (msg: string) => void) {
  const { indice } = useSesion();
  const [movidos, setMovidos] = useState<Record<string, Partial<Entregable>>>({});
  useEffect(() => setMovidos((m) => {
    const pendiente = ([ruta, c]: [string, Partial<Entregable>]) => {
      const e = indice.entregables.find((x) => x.ruta === ruta);
      return e !== undefined && Object.entries(c).some(([k, v]) => !igualValor(e[k as keyof Entregable], v));
    };
    const quedan = Object.entries(m).filter(pendiente);
    return quedan.length === Object.keys(m).length ? m : Object.fromEntries(quedan);
  }), [indice]);
  const es = indice.entregables.map((e) => (movidos[e.ruta] ? { ...e, ...movidos[e.ruta] } : e));
  const mover = (e: Entregable, cambios: Partial<Entregable>) => {
    if (Object.entries(cambios).every(([k, v]) => igualValor(e[k as keyof Entregable], v))) return;
    setMovidos((m) => ({ ...m, [e.ruta]: { ...m[e.ruta], ...cambios } }));
    cambiar(e.ruta, cambios).catch(() => {
      setMovidos(({ [e.ruta]: _, ...resto }) => resto);
      onError(`No se pudo guardar el cambio en “${titulo(e.ruta)}”. Revisa que el archivo se pueda leer.`);
    });
  };
  return { es, mover };
}

export function Tablero({ fecha, onEditar, onPedirClaude }: {
  fecha: string; onEditar: (ruta: string) => void; onPedirClaude?: (texto: string) => void;
}) {
  const { indice } = useSesion();
  const [actual, setActual] = useState<Actual>({ filtro: POR_DEFECTO[0].filtro, agrupar: "estado" });
  const [error, setError] = useState<string | null>(null);
  const { es, mover } = useMovidos(setError);
  const [sel, setSel] = useState<{ ruta: string; animar: boolean } | null>(null);
  const origen = useRef<HTMLElement | null>(null);
  const cerrar = useCallback(() => { setSel(null); origen.current?.focus(); }, []);

  const visibles = aplicar(es, actual.filtro, fecha).sort((a, b) => String(a.vence).localeCompare(String(b.vence)));
  const commits = useUltimosCommits(visibles.map((e) => e.ruta));
  const abrir = (ruta: string) => (ev: MouseEvent<HTMLElement>) => {
    origen.current = ev.currentTarget;
    setSel(sel?.ruta === ruta ? null : { ruta, animar: ev.detail !== 0 });
  };
  const abrirNueva = (ruta: string) => { origen.current = null; setSel({ ruta, animar: true }); };
  const tarjeta = (e: Entregable) => (
    <Tarjeta
      key={e.ruta} e={e} fecha={fecha} commit={commits.get(e.ruta)} abierta={sel?.ruta === e.ruta} onAbrir={abrir(e.ruta)}
      onCambiar={(c) => {
        mover(e, c);
        if ("estado" in c || "responsable" in c) seguirFoco(e.ruta); // cambia de columna o carril; etiquetas y fecha no
      }} onPedirClaude={onPedirClaude} onAbrirOtra={abrirNueva}
    />
  );
  const otraAgrupacion = actual.agrupar === "estado" ? "persona" : "estado";

  return (
    <>
      <main className="principal tablero">
        <CabezaVistas actual={actual} elegir={setActual} onError={setError} />
        <Filtros es={es} filtro={actual.filtro} cambiar={(filtro) => setActual({ ...actual, filtro })} fecha={fecha}>
          <span>{plural(visibles.length)}</span>
          <span className="sep" aria-hidden />
          <button className="btn plano" onClick={() => setActual({ ...actual, agrupar: otraAgrupacion })}>Agrupar por {actual.agrupar}</button>
        </Filtros>
        {error && <p className="error" role="alert">{error}</p>}
        {!visibles.length && (
          <p className="vacio">
            Nada calza con estos filtros.{" "}
            <button className="btn plano" onClick={() => setActual({ ...actual, filtro: {} })}>Ver todo</button>
          </p>
        )}
        {/* Las columnas se ven aunque estén vacías: su "+" crea la primera tarea. */}
        <Carriles visibles={visibles} porPersona={actual.agrupar === "persona"} mover={mover} tarjeta={tarjeta} onCreada={abrirNueva} />
      </main>
      {sel && <Panel key={sel.ruta} ruta={sel.ruta} animar={sel.animar} onCerrar={cerrar} onEditar={onEditar} />}
    </>
  );
}

/** Título, vistas guardadas (la que calza con los filtros de ahora queda marcada) y "+ Vista". */
function CabezaVistas({ actual, elegir, onError }: { actual: Actual; elegir: (a: Actual) => void; onError: (msg: string) => void }) {
  const [leidas, guardarLista, errorVistas] = useVistas();
  const vistas = leidas ?? POR_DEFECTO;
  const [nombrando, setNombrando] = useState(false);
  const cargadas = leidas !== null;
  // Al abrir, la primera vista del equipo.
  useEffect(() => { if (cargadas) elegir({ filtro: vistas[0].filtro, agrupar: vistas[0].agrupar }); }, [cargadas]);
  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const nombre = String(new FormData(ev.currentTarget).get("nombre")).trim();
    if (!nombre) return;
    const nueva = { nombre, filtro: actual.filtro, agrupar: actual.agrupar };
    guardarLista([...vistas.filter((v) => v.nombre !== nombre), nueva])
      .then(() => setNombrando(false), () => onError("No se pudo guardar la vista."));
  };
  return (
    <div className="tablero-cabeza">
      <h1 className="titulo">Tablero</h1>
      <div className="vistas" role="group" aria-label="Vistas guardadas">
        {vistas.map((v) => (
          <button key={v.nombre} aria-pressed={igual(v, actual)} onClick={() => elegir({ filtro: v.filtro, agrupar: v.agrupar })}>
            {v.nombre}
          </button>
        ))}
        {nombrando ? (
          <form className="nueva-vista" onSubmit={guardar} onKeyDown={(ev) => ev.key === "Escape" && setNombrando(false)}>
            <label className="oculto" htmlFor="nueva-vista">Nombre de la vista</label>
            <input id="nueva-vista" name="nombre" placeholder="Nombre de la vista" autoFocus required />
            <button className="btn" type="submit">Guardar</button>
          </form>
        ) : (
          // Hasta leer las del equipo no se guarda: se pisarían con las de fábrica.
          <button className="mas" onClick={() => setNombrando(true)} disabled={!cargadas} title="Guardar los filtros de ahora como vista">+ Vista</button>
        )}
      </div>
      {errorVistas && <p className="error" role="alert">⚠ {errorVistas}</p>}
    </div>
  );
}

/** Un carril con todo, o uno por responsable. Soltar en el carril de otra persona también la asigna. */
function Carriles({ visibles, porPersona, mover, tarjeta, onCreada }: {
  visibles: Entregable[]; porPersona: boolean; mover: (e: Entregable, c: Partial<Entregable>) => void;
  tarjeta: (e: Entregable) => ReactNode; onCreada: (ruta: string) => void;
}) {
  const { indice } = useSesion();
  const nombre = (slug: string) => (slug === "ia" ? "Claude" : indice.personas.find((p) => p.slug === slug)?.nombre ?? slug);
  const responsables = porPersona
    ? [...new Set([...indice.personas.map((p) => p.slug), "ia", ...visibles.map((e) => e.responsable)])]
      .filter((p) => visibles.some((e) => e.responsable === p))
    : [null];
  const buscar = (ruta: string) => visibles.find((e) => e.ruta === ruta);
  return responsables.map((p) => {
    const suyas = p ? visibles.filter((e) => e.responsable === p) : visibles;
    return (
      <section key={p ?? "todos"} className="carril" aria-label={p ? `Tareas de ${nombre(p)}` : undefined}>
        {p && (
          <h2 className="carril-cabeza">
            <span className="av" style={{ background: colorPersona(p) }} aria-hidden>{p === "ia" ? "✦" : nombre(p)[0]}</span>
            {nombre(p)} <span className="c">{suyas.length}</span>
          </h2>
        )}
        <Columnas
          es={suyas} buscar={buscar} tarjeta={tarjeta} responsable={p ?? undefined} onCreada={onCreada}
          onSoltar={(e, estado) => mover(e, p ? { estado, responsable: p } : { estado })}
        />
      </section>
    );
  });
}

function Columnas({ es, buscar, onSoltar, tarjeta, responsable, onCreada }: {
  es: Entregable[]; buscar: (ruta: string) => Entregable | undefined;
  onSoltar: (e: Entregable, estado: string) => void; tarjeta: (e: Entregable) => ReactNode;
  responsable?: string; onCreada: (ruta: string) => void;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [nueva, setNueva] = useState<string | null>(null); // estado de la columna con la tarjeta en blanco
  const mas = useRef<HTMLButtonElement | null>(null);
  const soltar = (estado: string) => (ev: DragEvent) => {
    ev.preventDefault();
    setSobre(null);
    const e = buscar(ev.dataTransfer.getData("text/plain")); // puede venir de otro carril
    if (e) onSoltar(e, estado);
  };
  return (
    <div className="columnas">
      {ESTADOS.map((estado) => {
        const aqui = es.filter((e) => e.estado === estado);
        return (
          <section
            key={estado} className={sobre === estado ? "col sobre" : "col"}
            aria-label={`${etiquetaEstado(estado)}, ${plural(aqui.length)}`}
            onDragOver={(ev) => {
              ev.preventDefault();
              ev.dataTransfer.dropEffect = "move";
              if (sobre !== estado) setSobre(estado);
            }}
            onDragLeave={(ev) => !ev.currentTarget.contains(ev.relatedTarget as Node) && setSobre(null)}
            onDrop={soltar(estado)}
          >
            <h3>
              <span className="anillo" data-estado={estado} style={{ borderColor: ANILLO[estado] }} aria-hidden />
              {etiquetaEstado(estado)} <span className="c">{aqui.length}</span>
              <button
                className="mas-col" aria-label={`Nueva tarea en ${etiquetaEstado(estado)}`} aria-expanded={nueva === estado}
                onClick={(ev) => { mas.current = ev.currentTarget; setNueva(estado); }}
              ><Plus size={TAM} aria-hidden /></button>
            </h3>
            {nueva === estado && (
              <NuevaTarea
                inicial={{ estado, ...(responsable && { responsable }) }}
                onCreada={(ruta) => { setNueva(null); onCreada(ruta); }}
                onCancelar={() => { setNueva(null); mas.current?.focus(); }}
              />
            )}
            {aqui.map(tarjeta)}
          </section>
        );
      })}
    </div>
  );
}

function Tarjeta({ e, fecha, commit, abierta, onAbrir, onCambiar, onPedirClaude, onAbrirOtra }: {
  e: Entregable; fecha: string; commit: Commit | undefined | null; abierta: boolean;
  onAbrir: (ev: MouseEvent<HTMLElement>) => void; onCambiar: (c: Partial<Entregable>) => void;
  onPedirClaude?: (texto: string) => void; onAbrirOtra: (ruta: string) => void;
}) {
  const { indice, persona: yo } = useSesion();
  const cliente = indice.clientes.find((c) => c.slug === e.cliente)?.nombre ?? e.cliente;
  const persona = e.responsable === "ia" ? "Claude" : indice.personas.find((p) => p.slug === e.responsable)?.nombre ?? e.responsable;
  const a = commit === null ? null : actividad(commit, new Date(), indice.personas);
  const mio = commit && autor(commit, indice.personas) === indice.personas.find((p) => p.slug === yo)?.nombre;
  // Lo publicado no está "quieto"; y lo que avanzaste tú ya lo sabes.
  const act = a && (e.estado !== "publicado" || a.tipo === "avanzo") && !(a.tipo === "avanzo" && mio) ? a : null;
  const c = cuando(e.vence, fecha);
  const tarde = c.tarde && e.estado !== "publicado";
  const t = titulo(e.ruta);
  return (
    <article
      className={e.estado === "publicado" ? "tarjeta fantasma" : "tarjeta"} draggable data-ruta={e.ruta}
      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.ruta); ev.dataTransfer.effectAllowed = "move"; }}
    >
      <button className="abrir" aria-pressed={abierta} onClick={onAbrir}>{t}</button>
      <MenuTarea e={e} onCambiar={onCambiar} onPedirClaude={onPedirClaude} onAbrir={onAbrirOtra} />
      <div className="cl"><span className="dot" style={{ background: colorPara(e.cliente) }} aria-hidden />{cliente}</div>
      {e.etiquetas?.length ? <Etiquetas slugs={e.etiquetas} /> : null}
      {act && <div className={`act ${act.tipo}`}><span aria-hidden>{ICONO[act.tipo]}</span>{act.texto}</div>}
      <div className="pie-tarjeta">
        <span className={tarde ? "tarde" : undefined}>
          {tarde ? `Vencía ${c.texto}` : c.texto[0].toUpperCase() + c.texto.slice(1)}
        </span>
        <span
          className="av" style={{ background: colorPersona(e.responsable) }} title={persona} aria-label={`Responsable: ${persona}`}
        >
          {e.responsable === "ia" ? "✦" : persona[0]}
        </span>
      </div>
    </article>
  );
}

/** Hasta tres etiquetas y "+N" con el resto. */
function Etiquetas({ slugs }: { slugs: string[] }) {
  const { indice } = useSesion();
  const resto = slugs.length - MAX_ETIQUETAS;
  return (
    <div className="etqs">
      {slugs.slice(0, MAX_ETIQUETAS).map((slug) => {
        const et = indice.etiquetas.find((x) => x.slug === slug);
        return <span key={slug} className="etq" style={et && ({ "--c": colorEtiqueta(et) } as CSSProperties)}>{et?.nombre ?? slug}</span>;
      })}
      {resto > 0 && <span className="etq" title={slugs.slice(MAX_ETIQUETAS).join(", ")}>+{resto}</span>}
    </div>
  );
}
