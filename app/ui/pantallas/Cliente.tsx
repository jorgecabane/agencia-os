import { type FormEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "../componentes/Editor";
import { Historial } from "../componentes/Historial";
import { Panel } from "../componentes/Panel";
import { aplicar } from "../datos/filtros";
import { colorPara, titulo } from "../datos/hoy";
import { separar } from "../datos/md";
import { promesasDeActa } from "../datos/promesas";
import { slugDe } from "../datos/resumen";
import { useSesion } from "../datos/sesion";
import type { Cliente as Ficha } from "../datos/tipos";
import type { Vista } from "../datos/vistas";
import { type Datos, Estado, Fila, type Lista, type Pagina, Resumen, type Tab } from "./ClienteResumen";
import { useVistas } from "./Tablero";

/** `onPedirClaude(texto, contexto)`: abre el chat con ese contexto (el cliente o el documento abierto). */
type Props = { slug: string; fecha: string; onPedirClaude?: (texto: string, contexto: string) => void; onErrorFuera: (msg: string) => void };

const DOCS: [archivo: string, etiqueta: string][] = [
  ["contexto.md", "Contexto"], ["brandbook.md", "Brandbook"], ["plan-contratado.md", "Plan"], ["material.md", "Material"],
];
const LISTAS: [Lista, string][] = [["entregables", "Entregables"], ["reuniones", "Reuniones"], ["decisiones", "Decisiones"]];
const CERRADOS = new Set(["publicado", "cancelado"]);
const encabezado = (t: string) => /^#\s+(.+?)\s*$/m.exec(separar(t).cuerpo)?.[1];
const mismaTab = (a: Tab, b: Tab) => JSON.stringify(a) === JSON.stringify(b);
const delCliente = (v: Vista, slug: string) => v.filtro.clientes?.length === 1 && v.filtro.clientes[0] === slug;

/** Cuerpos y archivos del cliente que el índice no trae. Se releen con cada cambio del índice o al pedirlo. */
function useDatos(slug: string): [Datos | null, () => void] {
  const { indice } = useSesion();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    const base = `clientes/${slug}`;
    const leer = (r: string) => window.aos.repo.read(r).catch(() => "");
    const listar = (g: string) => window.aos.repo.list(g).catch((): string[] => []);
    const slugs = new Set(indice.personas.map((p) => p.slug));
    const actas = indice.reuniones.filter((r) => r.cliente === slug && r.tipo === "reunion");
    void (async () => {
      const [archivos, pags, metricas, contexto, linea, ps] = await Promise.all([
        listar(`${base}/*.md`), listar(`${base}/paginas/*.md`), listar(`${base}/metricas/*.md`),
        leer(`${base}/contexto.md`), leer(`${base}/linea-de-tiempo.md`),
        Promise.all(actas.map(async (a) => promesasDeActa(a, separar(await leer(a.ruta)).cuerpo, slugs).promesas)),
      ]);
      const paginas = await Promise.all(pags.sort().map(async (ruta) => ({ ruta, etiqueta: encabezado(await leer(ruta)) ?? titulo(ruta) })));
      if (vivo) setDatos({ archivos, paginas, metricas: metricas.sort(), contexto, linea, promesas: ps.flat() });
    })();
    return () => { vivo = false; };
  }, [indice, slug, vuelta]);
  return [datos, useCallback(() => setVuelta((n) => n + 1), [])];
}

/** Panel de detalle de una tarea; al cerrarlo, el foco vuelve a la fila que lo abrió. */
function usePanel() {
  const [panel, setPanel] = useState<{ ruta: string; animar: boolean } | null>(null);
  const origen = useRef<HTMLElement | null>(null);
  const cerrarPanel = useCallback(() => { setPanel(null); origen.current?.focus(); }, []);
  const abrirPanel = (ruta: string) => (ev: MouseEvent<HTMLElement>) => {
    origen.current = ev.currentTarget;
    setPanel({ ruta, animar: ev.detail !== 0 });
  };
  return { panel, setPanel, abrirPanel, cerrarPanel };
}

const DocVacio = ({ cliente, etiqueta, onCrear }: { cliente: string; etiqueta: string; onCrear: () => void }) => (
  <div className="vacio-doc">
    <p>{cliente} todavía no tiene {etiqueta.toLowerCase()}.</p>
    <button className="btn pri" onClick={onCrear}>Crear {etiqueta.toLowerCase()}</button>
  </div>
);

export function Cliente({ slug, fecha, onPedirClaude, onErrorFuera }: Props) {
  const { indice } = useSesion();
  const ficha = indice.clientes.find((c) => c.slug === slug);
  const [datos, recargar] = useDatos(slug);
  const [vistas, guardarVistas] = useVistas();
  const [tab, setTab] = useState<Tab>({ k: "resumen" });
  const [abierto, setAbierto] = useState<string | null>(null); // página abierta desde una lista o el resumen
  const [historial, setHistorial] = useState(false);
  const { panel, setPanel, abrirPanel, cerrarPanel } = usePanel();
  const [error, setError] = useState<string | null>(null);
  if (!ficha) return <main className="principal"><p className="vacio">Este cliente ya no está en el repo.</p></main>;

  const base = `clientes/${slug}`;
  const elegir = (t: Tab) => { setTab(t); setAbierto(null); setHistorial(false); setError(null); };
  const fallo = (msg: string) => () => setError(msg);
  const mias = (vistas ?? []).filter((v) => delCliente(v, slug));
  const pedir = onPedirClaude && ((t: string) => onPedirClaude(t, base));
  const acciones = armarAcciones({ ficha, vistas, guardarVistas, recargar, elegir, fallo, onPedirClaude: pedir });

  const existe = (r: string) => Boolean(datos?.archivos.includes(r) || datos?.paginas.some((p) => p.ruta === r));
  const editable = abierto ?? (tab.k === "doc" && existe(tab.ruta) ? tab.ruta : null);
  const contenido = (): ReactNode => {
    if (historial && editable) return <Historial ruta={editable} onVolver={() => setHistorial(false)} />;
    const editor = editable && (
      <Editor key={editable} ruta={editable} onPedirClaude={onPedirClaude && ((t) => onPedirClaude(t, editable))} onErrorFuera={onErrorFuera} onHistorial={() => setHistorial(true)} />
    );
    if (abierto) return <><button className="btn plano volver" onClick={() => setAbierto(null)}>‹ Volver</button>{editor}</>;
    if (tab.k === "resumen") return <Resumen ficha={ficha} fecha={fecha} datos={datos} abrir={setAbierto} abrirPanel={abrirPanel} irA={elegir} onPedirClaude={pedir} />;
    if (tab.k === "lista") return <ListaCliente cual={tab.cual} slug={slug} fecha={fecha} abrir={setAbierto} />;
    if (tab.k === "vista") {
      const v = mias.find((x) => x.nombre === tab.nombre);
      return v ? <Tareas vista={v} fecha={fecha} abrirPanel={abrirPanel} abierta={panel?.ruta} /> : null;
    }
    if (editor) return editor;
    const doc = DOCS.find(([a]) => `${base}/${a}` === tab.ruta);
    return datos && doc && <DocVacio cliente={ficha.nombre} etiqueta={doc[1]} onCrear={() => void acciones.crear(...doc)} />;
  };

  return (
    <>
      <main className="principal cliente">
        <Cabecera ficha={ficha} compacta={tab.k !== "resumen" || abierto !== null} />
        <Pestanas tab={tab} elegir={elegir} slug={slug} paginas={datos?.paginas ?? []} vistas={mias} acciones={acciones} nombre={ficha.nombre} />
        {error && <p className="error" role="alert">⚠ {error}</p>}
        {contenido()}
      </main>
      {panel && <Panel key={panel.ruta} ruta={panel.ruta} animar={panel.animar} onCerrar={cerrarPanel} onEditar={(r) => { setPanel(null); setAbierto(r); }} />}
    </>
  );
}

type Contexto = {
  ficha: Ficha; vistas: Vista[] | null; guardarVistas: (vs: Vista[]) => Promise<void>; recargar: () => void;
  elegir: (t: Tab) => void; fallo: (msg: string) => () => void; onPedirClaude?: (texto: string) => void;
};

/** Lo que crean "+" y "Crear": páginas, vistas del cliente, pedidos a Claude y documentos desde la plantilla. */
function armarAcciones({ ficha, vistas, guardarVistas, recargar, elegir, fallo, onPedirClaude }: Contexto) {
  const { slug } = ficha;
  const base = `clientes/${slug}`;
  const acciones: Acciones = {
    pagina: async (t) => {
      const s = slugDe(t) || "pagina";
      let ruta = `${base}/paginas/${s}.md`;
      for (let n = 2; (await window.aos.repo.list(ruta)).length; n++) ruta = `${base}/paginas/${s}-${n}.md`;
      await window.aos.repo.write(ruta, `# ${t}\n`).then(() => { recargar(); elegir({ k: "doc", ruta }); }, fallo("No pude crear la página."));
    },
    // Hasta que se lean las vistas no se ofrece: guardar antes pisaría app/vistas.json con las de fábrica.
    vista: vistas ? async (nombre) => {
      const nueva: Vista = { nombre, filtro: { clientes: [slug] }, agrupar: "estado" };
      await guardarVistas([...vistas.filter((v) => v.nombre !== nombre), nueva]).then(() => elegir({ k: "vista", nombre }), fallo("No pude guardar la vista."));
    } : undefined,
    claude: onPedirClaude && (async (t) => onPedirClaude(`Créame una pestaña de ${t} para ${ficha.nombre}: una página en ${base}/paginas/.`)),
  };
  const crear = async (archivo: string, etiqueta: string) => {
    const plantilla = await window.aos.repo.read(`plantillas/cliente/${archivo}`).catch(() => `# ${etiqueta}\n`);
    await window.aos.repo.write(`${base}/${archivo}`, plantilla.replaceAll("cliente-ejemplo", slug)).then(recargar, fallo(`No pude crear ${etiqueta}.`));
  };
  return { ...acciones, crear };
}

function Cabecera({ ficha, compacta }: { ficha: Ficha; compacta: boolean }) {
  const { indice } = useSesion();
  const [copiado, setCopiado] = useState<string | null>(null);
  const resp = ficha.responsable === "ia" ? "Claude" : indice.personas.find((p) => p.slug === ficha.responsable)?.nombre ?? ficha.responsable;
  const marca = <span className="marca" style={{ background: colorPara(ficha.slug) }} aria-hidden>{ficha.nombre[0]}</span>;
  if (compacta) return <div className="cliente-cabeza compacta">{marca}<h1 className="titulo">{ficha.nombre}</h1></div>;
  // El shell solo abre https; cualquier otro link se copia para que la persona decida.
  const copiar = (url: string, nombre: string) => void navigator.clipboard.writeText(url).then(() => setCopiado(nombre), () => {});
  const links = ([["Drive", ficha.drive], ["ClickUp", ficha.clickup]] as [string, string | undefined][])
    .filter((l): l is [string, string] => Boolean(l[1]));
  return (
    <div className="cliente-cabeza">
      {marca}
      <div>
        <h1 className="titulo">{ficha.nombre}</h1>
        <div className="chips">
          <span className="chip"><b>{ficha.etapa[0].toUpperCase() + ficha.etapa.slice(1)}</b></span>
          <span className="chip">{ficha.modalidad[0].toUpperCase() + ficha.modalidad.slice(1)}</span>
          <span className="chip"><span className="k">Responsable</span>{resp}</span>
          {ficha.dominios_email?.[0] && <span className="chip">{ficha.dominios_email[0]}</span>}
          {links.map(([nombre, url]) => (
            <button key={nombre} className="chip boton" title={url} onClick={() => void window.aos.sistema.abrir(url).catch(() => copiar(url, nombre))}>
              {copiado === nombre ? `✓ Link de ${nombre} copiado` : <><span aria-hidden>↗</span>{nombre}</>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type Acciones = { pagina: (t: string) => Promise<void>; vista?: (t: string) => Promise<void>; claude?: (t: string) => Promise<void> };

function Pestanas({ tab, elegir, slug, paginas, vistas, acciones, nombre }: {
  tab: Tab; elegir: (t: Tab) => void; slug: string; paginas: Pagina[]; vistas: Vista[]; acciones: Acciones; nombre: string;
}) {
  const { indice } = useSesion();
  const n: Record<Lista, number> = {
    entregables: indice.entregables.filter((e) => e.cliente === slug).length,
    reuniones: indice.reuniones.filter((r) => r.cliente === slug).length,
    decisiones: indice.decisiones.filter((d) => d.cliente === slug).length,
  };
  const boton = (t: Tab, cuerpo: ReactNode, key: string) => (
    <button key={key} aria-current={mismaTab(t, tab) ? "page" : undefined} onClick={() => elegir(t)}>{cuerpo}</button>
  );
  return (
    <nav className="pestanas" aria-label={`Secciones de ${nombre}`}>
      {boton({ k: "resumen" }, <>Resumen <span className="auto">automático</span></>, "resumen")}
      {LISTAS.map(([cual, e]) => boton({ k: "lista", cual }, <>{e} <span className="c">{n[cual]}</span></>, cual))}
      {DOCS.map(([a, e]) => boton({ k: "doc", ruta: `clientes/${slug}/${a}` }, e, a))}
      {paginas.map((p) => boton({ k: "doc", ruta: p.ruta }, p.etiqueta, p.ruta))}
      {vistas.map((v) => boton({ k: "vista", nombre: v.nombre }, <><span aria-hidden>▦</span> {v.nombre}</>, `vista-${v.nombre}`))}
      <MenuMas acciones={acciones} nombre={nombre} />
    </nav>
  );
}

const OPCIONES = {
  pagina: { titulo: "Página en blanco", sub: "Texto, tablas e imágenes, como Notion", label: "Título de la página", ok: "Crear página" },
  vista: { titulo: "Vista de tareas", sub: "Las tareas de este cliente", label: "Nombre de la vista", ok: "Guardar vista" },
  claude: { titulo: "Pedírsela a Claude", sub: "“Una pestaña con los influencers que hemos contactado”", label: "¿De qué es la pestaña?", ok: "Pedírsela" },
} as const;
type Opcion = keyof typeof OPCIONES;

/** "+": página en blanco, vista de tareas del cliente o pedírsela a Claude. Cada una pide un nombre. */
function MenuMas({ acciones, nombre }: { acciones: Acciones; nombre: string }) {
  const [menu, setMenu] = useState<{ animar: boolean; modo: Opcion | null } | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => { setMenu(null); boton.current?.focus(); }, []);
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => !caja.current?.parentElement?.contains(e.target as Node) && setMenu(null);
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [menu]);
  const enviar = (modo: Opcion) => (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const t = String(new FormData(ev.currentTarget).get("nombre")).trim();
    if (t) void acciones[modo]?.(t).then(() => setMenu(null));
  };
  const modo = menu?.modo;
  return (
    <span className="ancla mas-ancla">
      <button ref={boton} className="mas" aria-label="Agregar pestaña" aria-expanded={Boolean(menu)} aria-haspopup="dialog"
        onClick={(e) => setMenu(menu ? null : { animar: e.detail !== 0, modo: null })}>+</button>
      {menu && (
        <div ref={caja} className={menu.animar ? "pop menu-mas anima" : "pop menu-mas"} role="dialog" aria-label="Agregar pestaña"
          onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), cerrar())}>
          {modo ? (
            <form onSubmit={enviar(modo)}>
              <label htmlFor="pestana-nueva">{OPCIONES[modo].label}</label>
              <input id="pestana-nueva" name="nombre" autoFocus required defaultValue={modo === "vista" ? `Tareas de ${nombre}` : ""}
                placeholder={modo === "claude" ? "los influencers que hemos contactado" : undefined} />
              <button className="btn pri" type="submit">{OPCIONES[modo].ok}</button>
            </form>
          ) : (Object.keys(OPCIONES) as Opcion[]).map((k, i) => (
            <button key={k} className="op" autoFocus={i === 0} disabled={!acciones[k]} onClick={() => setMenu({ ...menu, modo: k })}>
              <span>{OPCIONES[k].titulo}<small>{acciones[k] ? OPCIONES[k].sub : "Cargando…"}</small></span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function ListaCliente({ cual, slug, fecha, abrir }: { cual: Lista; slug: string; fecha: string; abrir: (r: string) => void }) {
  const { indice } = useSesion();
  const filas = cual === "entregables"
    ? indice.entregables.filter((e) => e.cliente === slug).map((e) => ({ ruta: e.ruta, f: e.vence, der: <Estado estado={e.estado} />, alerta: !CERRADOS.has(e.estado) }))
    : (cual === "reuniones" ? indice.reuniones : indice.decisiones).filter((x) => x.cliente === slug).map((x) => ({
      ruta: x.ruta, f: x.fecha, alerta: false, der: "tipo" in x ? <span className="st">{x.tipo === "brief-reunion" ? "Brief" : "Acta"}</span> : null,
    }));
  filas.sort((a, b) => String(b.f).localeCompare(String(a.f)));
  if (!filas.length) return <p className="vacio">Todavía no hay {cual}.</p>;
  return <ul className="lista">{filas.map((x) => <Fila key={x.ruta} cuandoF={x.f} fecha={fecha} t={titulo(x.ruta)} derecha={x.der} onClick={() => abrir(x.ruta)} alerta={x.alerta} />)}</ul>;
}

function Tareas({ vista, fecha, abrirPanel, abierta }: {
  vista: Vista; fecha: string; abrirPanel: (r: string) => (ev: MouseEvent<HTMLElement>) => void; abierta?: string;
}) {
  const { indice } = useSesion();
  const es = aplicar(indice.entregables, vista.filtro, fecha).sort((a, b) => String(a.vence).localeCompare(String(b.vence)));
  if (!es.length) return <p className="vacio">No hay tareas en esta vista.</p>;
  const nombre = (s: string) => (s === "ia" ? "Claude" : indice.personas.find((p) => p.slug === s)?.nombre ?? s);
  return (
    <ul className="lista">{es.map((e) => (
      <Fila key={e.ruta} cuandoF={e.vence} fecha={fecha} t={titulo(e.ruta)} sub={`${nombre(e.responsable)} · ${e.formato}`}
        derecha={<Estado estado={e.estado} />} onClick={abrirPanel(e.ruta)} pressed={abierta === e.ruta} alerta={!CERRADOS.has(e.estado)} />
    ))}</ul>
  );
}

