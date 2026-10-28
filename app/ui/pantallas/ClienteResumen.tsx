import type { MouseEvent, ReactNode } from "react";
import { etiquetaEstado } from "../componentes/Filtros";
import { ANILLO } from "../componentes/Panel";
import { cuando, horaDe, titulo } from "../datos/hoy";
import { evento, resumen, sinWikilinks, type Cuerpos } from "../datos/resumen";
import { useSesion } from "../datos/sesion";
import type { Cliente as Ficha } from "../datos/tipos";

export type Lista = "entregables" | "reuniones" | "decisiones";
export type Tab = { k: "resumen" } | { k: "lista"; cual: Lista } | { k: "doc"; ruta: string } | { k: "vista"; nombre: string };
export type Pagina = { ruta: string; etiqueta: string };
export type Datos = Cuerpos & { archivos: string[]; paginas: Pagina[]; metricas: string[] };

const MAX_APRENDIMOS = 5;
/** "hoy", "ayer", "mañana" o "21 oct": lo de hace semanas no se lee bien como "mié 21". */
function fechaCorta(f: string, hoy: string): string {
  const c = cuando(f, hoy).texto;
  return ["hoy", "ayer", "mañana"].includes(c) ? c : new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
}
/** Una fila de lista: cuándo, qué, detalle y algo a la derecha. */
export function Fila({ cuandoF, fecha, t, sub, derecha, onClick, pressed, alerta = false }: {
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

export const Estado = ({ estado }: { estado: string }) => (
  <span className="st"><span className="anillo" style={{ borderColor: ANILLO[estado] }} aria-hidden />{etiquetaEstado(estado)}</span>
);

function Seccion({ titulo: t, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return <section className="bloque"><h2 className="s">{t}{extra}</h2>{children}</section>;
}

export function Resumen({ ficha, fecha, datos, abrir, abrirPanel, irA, onPedirClaude }: {
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
            <Fila key={p.acta + k} cuandoF={p.fecha} fecha={fecha} t={p.que[0].toUpperCase() + p.que.slice(1)} sub={`${p.quien} lo prometió en ${titulo(p.acta)}`} onClick={() => abrir(p.acta)} alerta />
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
  const hora = horaDe(r.fecha);
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
