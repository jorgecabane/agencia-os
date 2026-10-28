import { Sparkles } from "lucide-react";
import { colorPersona, etiquetaEstado } from "../componentes/Filtros";
import { ICONO } from "../componentes/Lateral";
import { ANILLO } from "../componentes/Panel";
import { lunes } from "../datos/calendario";
import { type Carga, carga, LIMITE_ALTA } from "../datos/carga";
import { ESTADOS } from "../datos/filtros";
import { useSesion } from "../datos/sesion";
import "./equipo.css";

// Publicado no cuenta en la carga.
const ABIERTOS = ESTADOS.filter((e) => e !== "publicado");
const color = (estado: string) => ANILLO[estado] ?? "var(--tenue)";
const tareas = (n: number) => `${n} ${n === 1 ? "tarea" : "tareas"}`;
const atrasadas = (n: number) => `${n} ${n === 1 ? "atrasada" : "atrasadas"}`;
const semanaDe = (fecha: string) =>
  new Date(`${lunes(fecha)}T12:00:00Z`).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "UTC" });

/** Carga de la semana por persona; clic en una fila abre el Tablero filtrado por ella. */
export function Equipo({ fecha, onVerPersona, onPedirClaude }: {
  fecha: string; onVerPersona: (slug: string) => void; onPedirClaude: (texto: string) => void;
}) {
  const { indice } = useSesion();
  const filas = carga(indice, fecha);
  const escala = Math.max(LIMITE_ALTA, ...filas.map((f) => f.total));
  const altas = filas.filter((f) => f.alta);
  return (
    <main className="principal equipo">
      <h1 className="titulo">Equipo</h1>
      <p className="bajada">Semana del {semanaDe(fecha)}</p>
      <ul className="carga-leyenda" aria-label="Estados">
        {ABIERTOS.map((e) => <li key={e}><span className="seg-muestra" style={{ background: color(e) }} aria-hidden />{etiquetaEstado(e)}</li>)}
      </ul>
      <ul className="carga">
        {filas.map((f) => <li key={f.slug}><Fila f={f} escala={escala} onClick={() => onVerPersona(f.slug)} /></li>)}
      </ul>
      {altas.length > 0 && <Redistribuir altas={altas} onPedirClaude={onPedirClaude} />}
    </main>
  );
}

function Fila({ f, escala, onClick }: { f: Carga; escala: number; onClick: () => void }) {
  const detalle = ABIERTOS.filter((e) => f.porEstado[e]).map((e) => `${f.porEstado[e]} ${etiquetaEstado(e).toLowerCase()}`).join(", ");
  const resumen = [tareas(f.total), f.atrasadas > 0 && atrasadas(f.atrasadas), f.alta && "carga alta"].filter(Boolean).join(", ");
  return (
    <button className="carga-fila" onClick={onClick} aria-label={`${f.nombre}: ${resumen}${detalle && ` (${detalle})`}. Ver su Tablero`}>
      <span className="quien">
        <span className="av" style={{ background: colorPersona(f.slug) }} aria-hidden>{f.slug === "ia" ? "✦" : f.nombre[0]}</span>{f.nombre}
      </span>
      <span className="barra-c" aria-hidden>
        {ABIERTOS.filter((e) => f.porEstado[e]).map((e) => (
          <i key={e} style={{ width: `${(f.porEstado[e] / escala) * 100}%`, background: color(e) }} title={`${etiquetaEstado(e)}: ${f.porEstado[e]}`} />
        ))}
      </span>
      <span className={f.alta ? "num alta" : "num"} aria-hidden>
        {f.total}{f.atrasadas > 0 && ` · ${atrasadas(f.atrasadas)}`}{f.alta && " · alta"}
      </span>
    </button>
  );
}

function Redistribuir({ altas, onPedirClaude }: { altas: Carga[]; onPedirClaude: (texto: string) => void }) {
  const [mas] = altas; // vienen ordenadas: la primera es la más cargada
  const texto = altas.length === 1
    ? `${mas.nombre} tiene ${tareas(mas.total)} y ${atrasadas(mas.atrasadas)} esta semana.`
    : `${new Intl.ListFormat("es", { type: "conjunction" }).format(altas.map((f) => f.nombre))} tienen ${LIMITE_ALTA} tareas o más esta semana.`;
  const pedido = `Redistribuye la carga de esta semana: ${mas.nombre} tiene ${mas.total} tareas y ${mas.atrasadas} atrasadas. Propón qué mover y a quién, sin cambiar nada hasta que lo apruebe.`;
  return (
    <div className="alerta-carga" role="status">
      <Sparkles size={ICONO} aria-hidden />
      <span className="grow">{texto}</span>
      <button className="btn" onClick={() => onPedirClaude(pedido)}>Pedirle a Claude que redistribuya</button>
    </div>
  );
}
