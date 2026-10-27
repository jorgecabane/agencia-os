import { type FormEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "../componentes/Editor";
import { etiquetaEstado } from "../componentes/Filtros";
import { Historial } from "../componentes/Historial";
import { ANILLO, Panel } from "../componentes/Panel";
import { aplicar } from "../datos/filtros";
import { colorPara, cuando, titulo } from "../datos/hoy";
import { separar } from "../datos/md";
import { promesasDeActa } from "../datos/promesas";
import { evento, resumen, sinWikilinks, slugDe, type Cuerpos } from "../datos/resumen";
import { useSesion } from "../datos/sesion";
import type { Cliente as Ficha } from "../datos/tipos";
import { POR_DEFECTO, type Vista } from "../datos/vistas";
import { useVistas } from "./Tablero";

type Lista = "entregables" | "reuniones" | "decisiones";
type Tab = { k: "resumen" } | { k: "lista"; cual: Lista } | { k: "doc"; ruta: string } | { k: "vista"; nombre: string };
type Pagina = { ruta: string; etiqueta: string };
type Datos = Cuerpos & { archivos: string[]; paginas: Pagina[]; metricas: string[] };
type Props = { slug: string; fecha: string; onPedirClaude?: (texto: string) => void; onErrorFuera: (msg: string) => void };

const DOCS: [archivo: string, etiqueta: string][] = [
  ["contexto.md", "Contexto"], ["brandbook.md", "Brandbook"], ["plan-contratado.md", "Plan"], ["material.md", "Material"],
];
const LISTAS: [Lista, string][] = [["entregables", "Entregables"], ["reuniones", "Reuniones"], ["decisiones", "Decisiones"]];
const MAX_APRENDIMOS = 5;
const CERRADOS = new Set(["publicado", "cancelado"]);
const encabezado = (t: string) => /^#\s+(.+?)\s*$/m.exec(separar(t).cuerpo)?.[1];
/** "hoy", "ayer", "mañana" o "21 oct": lo de hace semanas no se lee bien como "mié 21". */
function fechaCorta(f: string, hoy: string): string {
  const c = cuando(f, hoy).texto;
  return ["hoy", "ayer", "mañana"].includes(c) ? c : new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
}
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
  const acciones = armarAcciones({ ficha, vistas, guardarVistas, recargar, elegir, fallo, onPedirClaude });

  const existe = (r: string) => Boolean(datos?.archivos.includes(r) || datos?.paginas.some((p) => p.ruta === r));
  const editable = abierto ?? (tab.k === "doc" && existe(tab.ruta) ? tab.ruta : null);
  const contenido = (): ReactNode => {
    if (historial && editable) return <Historial ruta={editable} onVolver={() => setHistorial(false)} />;
    const editor = editable && (
      <Editor key={editable} ruta={editable} onPedirClaude={onPedirClaude} onErrorFuera={onErrorFuera} onHistorial={() => setHistorial(true)} />
    );
    if (abierto) return <><button className="btn plano volver" onClick={() => setAbierto(null)}>‹ Volver</button>{editor}</>;
    if (tab.k === "resumen") return <Resumen ficha={ficha} fecha={fecha} datos={datos} abrir={setAbierto} abrirPanel={abrirPanel} irA={elegir} onPedirClaude={onPedirClaude} />;
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
    vista: async (nombre) => {
      const nueva: Vista = { nombre, filtro: { clientes: [slug] }, agrupar: "estado" };
      const todas = (vistas ?? POR_DEFECTO).filter((v) => v.nombre !== nombre);
      await guardarVistas([...todas, nueva]).then(() => elegir({ k: "vista", nombre }), fallo("No pude guardar la vista."));
    },
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
  const [copiado, setCopiado] = useState(false);
  const resp = ficha.responsable === "ia" ? "Claude" : indice.personas.find((p) => p.slug === ficha.responsable)?.nombre ?? ficha.responsable;
  const marca = <span className="marca" style={{ background: colorPara(ficha.slug) }} aria-hidden>{ficha.nombre[0]}</span>;
  if (compacta) return <div className="cliente-cabeza compacta">{marca}<h1 className="titulo">{ficha.nombre}</h1></div>;
  const copiar = (url: string) => void navigator.clipboard.writeText(url).then(() => setCopiado(true), () => {});
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
          {ficha.drive && (
            <button className="chip boton" onClick={() => copiar(ficha.drive!)} title={ficha.drive}>
              {copiado ? "✓ Link de Drive copiado" : "Copiar link de Drive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Acciones = { pagina: (t: string) => Promise<void>; vista: (t: string) => Promise<void>; claude?: (t: string) => Promise<void> };

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
              <span>{OPCIONES[k].titulo}<small>{acciones[k] ? OPCIONES[k].sub : "Disponible cuando esté el chat"}</small></span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Una fila de lista: cuándo, qué, detalle y algo a la derecha. */
function Fila({ cuandoF, fecha, t, sub, derecha, onClick, pressed, alerta = false }: {
  cuandoF?: string | null; fecha: string; alerta?: boolean; t: string; sub?: ReactNode; derecha?: ReactNode;
  onClick: (ev: MouseEvent<HTMLElement>) => void; pressed?: boolean;
}) {
  const c = cuandoF ? cuando(cuandoF, fecha) : null;
  const d = c ? c.texto[0].toUpperCase() + c.texto.slice(1) : cuandoF === null ? "Sin fecha" : "";
  return (
    <li>
      <button className={d ? "li" : "li sin-fecha"} onClick={onClick} aria-pressed={pressed}>
        {d && <span className={alerta && c?.tarde ? "d tarde" : "d"}>{d}</span>}
        <span><span className="t">{t}</span>{sub && <span className="sub">{sub}</span>}</span>
        {derecha}
      </button>
    </li>
  );
}

const Estado = ({ estado }: { estado: string }) => (
  <span className="st"><span className="anillo" style={{ borderColor: ANILLO[estado] }} aria-hidden />{etiquetaEstado(estado)}</span>
);

function Seccion({ titulo: t, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return <section className="bloque"><h2 className="s">{t}{extra}</h2>{children}</section>;
}

function Resumen({ ficha, fecha, datos, abrir, abrirPanel, irA, onPedirClaude }: {
  ficha: Ficha; fecha: string; datos: Datos | null; abrir: (r: string) => void;
  abrirPanel: (r: string) => (ev: MouseEvent<HTMLElement>) => void; irA: (t: Tab) => void; onPedirClaude?: (t: string) => void;
}) {
  const { indice } = useSesion();
  const r = resumen(indice, ficha.slug, fecha, datos ?? {});
  const nombre = (s: string) => (s === "ia" ? "Claude" : indice.personas.find((p) => p.slug === s)?.nombre ?? s);
  const semana = datos?.metricas.at(-1);
  return (
    <div className="resumen">
      <div>
        <Seccion titulo="Lo próximo"><Proxima r={r.proxima} fecha={fecha} abrir={abrir} cliente={ficha.nombre} onPedirClaude={onPedirClaude} /></Seccion>
        <Seccion titulo="Entregables abiertos" extra={<button className="btn plano" onClick={() => irA({ k: "lista", cual: "entregables" })}>Ver todos</button>}>
          {r.abiertos.length ? <ul className="lista">{r.abiertos.map((e) => (
            <Fila key={e.ruta} cuandoF={e.vence} fecha={fecha} t={titulo(e.ruta)} sub={nombre(e.responsable)} derecha={<Estado estado={e.estado} />} onClick={abrirPanel(e.ruta)} alerta />
          ))}</ul> : <p className="vacio">No hay entregables abiertos.</p>}
        </Seccion>
        <Seccion titulo="Lo que nos debe">
          {r.debe.length ? <ul className="lista">{r.debe.map((p, k) => (
            <Fila key={p.acta + k} cuandoF={p.fecha} fecha={fecha} t={p.que} sub={`${p.quien} lo prometió en ${titulo(p.acta)}`} onClick={() => abrir(p.acta)} alerta />
          ))}</ul> : <p className="vacio">No nos debe nada.</p>}
        </Seccion>
      </div>
      <aside>
        {semana && (
          <Seccion titulo="Esta semana">
            <ul className="lista"><Fila fecha={fecha} t={`Métricas ${titulo(semana)}`} sub="Abrir el informe de la semana" onClick={() => abrir(semana)} /></ul>
          </Seccion>
        )}
        <Seccion titulo="Lo que aprendimos" extra={<button className="btn plano" onClick={() => irA({ k: "doc", ruta: `clientes/${ficha.slug}/contexto.md` })}>Editar</button>}>
          {r.aprendimos.length ? <div className="aprendimos">{r.aprendimos.slice(-MAX_APRENDIMOS).reverse().map((a) => {
            const m = /^(\d{4}-\d{2}-\d{2}):\s*(.*)$/.exec(a);
            return <p key={a}>{sinWikilinks(m ? m[2] : a)} {m && <span className="src">{fechaCorta(m[1], fecha)}</span>}</p>;
          })}</div> : <p className="vacio">Todavía no anotamos aprendizajes.</p>}
        </Seccion>
        <Seccion titulo="Línea de tiempo"><LineaDeTiempo linea={r.linea} fecha={fecha} nombre={nombre} /></Seccion>
      </aside>
    </div>
  );
}

function Proxima({ r, fecha, abrir, cliente, onPedirClaude }: {
  r: ReturnType<typeof resumen>["proxima"]; fecha: string; abrir: (r: string) => void; cliente: string; onPedirClaude?: (t: string) => void;
}) {
  if (!r) return <p className="vacio">No hay reuniones con brief por delante.</p>;
  const hora = /T(\d{2}:\d{2})/.exec(String(r.fecha))?.[1];
  const c = cuando(r.fecha, fecha).texto;
  return (
    <div className="proxima">
      <div className="cuando">{c[0].toUpperCase() + c.slice(1)}{hora && `, ${hora}`}</div>
      <div className="que">{titulo(r.ruta)}</div>
      <div className="acciones">
        <button className="btn pri" onClick={() => abrir(r.ruta)}>Abrir brief</button>
        <button className="btn" disabled={!onPedirClaude} aria-disabled={!onPedirClaude}
          onClick={() => onPedirClaude?.(`Prepárame para la reunión “${titulo(r.ruta)}” de ${cliente} ([[${r.ruta.replace(/\.md$/, "")}]]).`)}>
          Preguntarle a Claude
        </button>
      </div>
    </div>
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

function LineaDeTiempo({ linea, fecha, nombre }: { linea: string[]; fecha: string; nombre: (slug: string) => string }) {
  if (!linea.length) return <p className="vacio">Sin eventos todavía.</p>;
  return (
    <ol className="tl">{linea.map((l, k) => {
      const e = evento(l);
      return (
        <li key={k} className={e.quien === "ia" ? "ev ia" : "ev"}>
          {e.fecha && <span className="cuando">{fechaCorta(e.fecha, fecha)}</span>}
          <span className="txt">{e.texto}{e.quien && <span className="quien"> · {nombre(e.quien)}</span>}</span>
        </li>
      );
    })}</ol>
  );
}
