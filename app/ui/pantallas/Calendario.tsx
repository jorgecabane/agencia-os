import { type DragEvent, type KeyboardEvent, type MouseEvent, useCallback, useRef, useState } from "react";
import { Filtros } from "../componentes/Filtros";
import { Panel } from "../componentes/Panel";
import { type Dia, dias, esReunion, type Item, lunes, semanas, sumarDias, sumarMeses } from "../datos/calendario";
import type { Filtro } from "../datos/filtros";
import { colorPara, cuando, titulo } from "../datos/hoy";
import { useSesion } from "../datos/sesion";
import type { Entregable } from "../datos/tipos";
import { useMovidos } from "./Tablero";
import "./pantallas.css";

type Vista = "mes" | "semana";
const MAX_EN_MES = 4;
const SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const CERRADOS = new Set(["publicado", "cancelado"]);
// Alt + flecha mueve la tarea un día (← →) o una semana (↑ ↓).
const TECLAS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const largo = (dia: string, o: Intl.DateTimeFormatOptions) => new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CL", { ...o, timeZone: "UTC" });
// Si la tarea salió de lo que se ve (otro mes o semana), el foco va al rótulo del calendario.
const seguirFoco = (ruta: string) => requestAnimationFrame(() =>
  (document.querySelector<HTMLElement>(`.cal [data-ruta="${CSS.escape(ruta)}"]`) ?? document.querySelector<HTMLElement>(".cal-rotulo"))?.focus());

export function Calendario({ fecha, onEditar }: { fecha: string; onEditar: (ruta: string) => void }) {
  const { indice } = useSesion();
  const [vista, setVista] = useState<Vista>("mes");
  const [ancla, setAncla] = useState(fecha);
  const [filtro, setFiltro] = useState<Filtro>({});
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const { es, mover } = useMovidos(setError);
  const [sel, setSel] = useState<{ ruta: string; animar: boolean } | null>(null);
  const origen = useRef<HTMLElement | null>(null);
  const cerrar = useCallback(() => { setSel(null); origen.current?.focus(); }, []);

  const i = { ...indice, entregables: es };
  const mes = ancla.slice(0, 7);
  const filas = vista === "mes" ? semanas(i, mes, filtro, fecha) : [dias(i, lunes(ancla), sumarDias(lunes(ancla), 6), filtro, fecha)];
  const paso = (n: number) => setAncla(vista === "mes" ? `${sumarMeses(mes, n)}-01` : sumarDias(ancla, 7 * n));
  const visibles = filas.flat();
  const mueve = (e: Entregable, dia: string) => {
    mover(e, { vence: dia }); // solo `vence`: `recurrencia_fecha` queda como estaba
    const fuera = dia < visibles[0].dia || dia > visibles[visibles.length - 1].dia ? ", fuera de esta vista" : "";
    setAnuncio(`${titulo(e.ruta)} ahora vence el ${largo(dia, { weekday: "long", day: "numeric", month: "long" })}${fuera}`);
  };
  const ctx: Ctx = {
    fecha, mes: vista === "mes" ? mes : null, sel: sel?.ruta, es, mueve,
    abrir: (ruta) => (ev) => { origen.current = ev.currentTarget; setSel(sel?.ruta === ruta ? null : { ruta, animar: ev.detail !== 0 }); },
    verSemana: (dia) => { setVista("semana"); setAncla(dia); },
  };
  return (
    <>
      <main className="principal cal">
        <Cabeza vista={vista} setVista={setVista} ancla={ancla} paso={paso} hoy={() => setAncla(fecha)} />
        <Filtros es={es} filtro={filtro} cambiar={setFiltro} fecha={fecha}>
          <span className="cal-ayuda">Arrastra una tarea a otro día, o usa Alt + flechas</span>
        </Filtros>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="oculto" role="status">{anuncio}</p>
        <Grilla filas={filas} ctx={ctx} />
      </main>
      {sel && <Panel key={sel.ruta} ruta={sel.ruta} animar={sel.animar} onCerrar={cerrar} onEditar={onEditar} />}
    </>
  );
}

function Cabeza({ vista, setVista, ancla, paso, hoy }: {
  vista: Vista; setVista: (v: Vista) => void; ancla: string; paso: (n: number) => void; hoy: () => void;
}) {
  const desde = lunes(ancla);
  const rotulo = vista === "mes"
    ? largo(`${ancla.slice(0, 7)}-01`, { month: "long", year: "numeric" })
    : `${largo(desde, { day: "numeric", month: "short" })} – ${largo(sumarDias(desde, 6), { day: "numeric", month: "short" })}`;
  const unidad = vista === "mes" ? "Mes" : "Semana";
  return (
    <div className="tablero-cabeza">
      <h1 className="titulo">Calendario</h1>
      <div className="vistas" role="group" aria-label="Vista">
        {(["mes", "semana"] as const).map((v) => (
          <button key={v} aria-pressed={vista === v} onClick={() => setVista(v)}>{v === "mes" ? "Mes" : "Semana"}</button>
        ))}
      </div>
      <div className="cal-nav">
        <button className="btn plano" onClick={() => paso(-1)} aria-label={`${unidad} anterior`}>‹</button>
        <h2 className="cal-rotulo" aria-live="polite" tabIndex={-1}>{rotulo}</h2>
        <button className="btn plano" onClick={() => paso(1)} aria-label={`${unidad} siguiente`}>›</button>
        <button className="btn" onClick={hoy}>Hoy</button>
      </div>
    </div>
  );
}

type Ctx = {
  fecha: string; mes: string | null; sel?: string; es: Entregable[];
  mueve: (e: Entregable, dia: string) => void; abrir: (ruta: string) => (ev: MouseEvent<HTMLElement>) => void;
  verSemana: (dia: string) => void;
};

function Grilla({ filas, ctx }: { filas: Dia[][]; ctx: Ctx }) {
  return (
    <div className={ctx.mes ? "cal-grilla" : "cal-grilla semana"}>
      {SEMANA.map((d) => <div key={d} className="cal-dow" aria-hidden>{d}</div>)}
      {filas.flat().map((d) => <Celda key={d.dia} d={d} ctx={ctx} />)}
    </div>
  );
}

function Celda({ d, ctx }: { d: Dia; ctx: Ctx }) {
  const [sobre, setSobre] = useState(false);
  const fuera = ctx.mes !== null && !d.dia.startsWith(ctx.mes);
  const visibles = ctx.mes ? d.items.slice(0, MAX_EN_MES) : d.items;
  const resto = d.items.length - visibles.length;
  const soltar = (ev: DragEvent) => {
    ev.preventDefault();
    setSobre(false);
    const e = ctx.es.find((x) => x.ruta === ev.dataTransfer.getData("text/plain"));
    if (e && e.vence !== d.dia) ctx.mueve(e, d.dia);
  };
  const clases = ["cal-dia", fuera && "fuera", d.dia === ctx.fecha && "hoy", sobre && "sobre"].filter(Boolean).join(" ");
  const nombre = largo(d.dia, { weekday: "long", day: "numeric", month: "long" });
  return (
    <section
      className={clases} aria-label={`${nombre}, ${d.items.length === 1 ? "1 cosa" : `${d.items.length} cosas`}`}
      onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; if (!sobre) setSobre(true); }}
      onDragLeave={(ev) => !ev.currentTarget.contains(ev.relatedTarget as Node) && setSobre(false)}
      onDrop={soltar}
    >
      <span className="cal-num" aria-current={d.dia === ctx.fecha ? "date" : undefined}>
        {ctx.mes ? Number(d.dia.slice(8)) : largo(d.dia, { weekday: "short", day: "numeric" }).replace(".", "")}
      </span>
      {visibles.map((x) => <CalItem key={x.ruta} x={x} ctx={ctx} />)}
      {resto > 0 && <button className="cal-mas" onClick={() => ctx.verSemana(d.dia)}>{resto} más</button>}
    </section>
  );
}

function CalItem({ x, ctx }: { x: Item; ctx: Ctx }) {
  const { indice } = useSesion();
  const cliente = indice.clientes.find((c) => c.slug === x.cliente)?.nombre ?? x.cliente;
  const t = titulo(x.ruta);
  if (esReunion(x)) {
    const hora = String(x.fecha).length > 10 ? String(x.fecha).slice(11, 16) : "";
    return (
      <button className="cal-item reunion" aria-pressed={ctx.sel === x.ruta} onClick={ctx.abrir(x.ruta)} title={`Reunión con ${cliente}`}>
        <span className="cal-ic" aria-hidden>◷</span>{hora && <span className="cal-hora">{hora}</span>}
        <span className="cal-t">{t}</span>{!ctx.mes && <span className="cal-sub">Reunión · {cliente}</span>}
      </button>
    );
  }
  const cerrado = CERRADOS.has(x.estado);
  const tarde = !cerrado && cuando(x.vence, ctx.fecha).tarde;
  const tecla = (ev: KeyboardEvent) => {
    const delta = ev.altKey ? TECLAS[ev.key] : undefined;
    if (!delta) return;
    ev.preventDefault();
    ctx.mueve(x, sumarDias(String(x.vence).slice(0, 10), delta));
    seguirFoco(x.ruta);
  };
  return (
    <button
      className={`cal-item${cerrado ? " cerrado" : ""}`} data-ruta={x.ruta} draggable aria-pressed={ctx.sel === x.ruta}
      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", x.ruta); ev.dataTransfer.effectAllowed = "move"; }}
      onClick={ctx.abrir(x.ruta)} onKeyDown={tecla} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
      title={`${cliente}${tarde ? " · atrasada" : ""}`}
    >
      <span className="dot" style={{ background: colorPara(x.cliente) }} aria-hidden />
      {tarde && <span className="cal-tarde" aria-label="atrasada">▲</span>}
      {x.estado === "publicado" && <span className="cal-ok" aria-label="publicada">✓</span>}
      <span className="cal-t">{t}</span>{!ctx.mes && <span className="cal-sub">{cliente} · {x.formato}</span>}
    </button>
  );
}
