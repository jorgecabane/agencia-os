import { useEffect, useRef, useState } from "react";
import type { Commit } from "../../shared/puente";
import { comentarios } from "../datos/comentarios";
import { colorPara, cuando, fechaLocal, titulo } from "../datos/hoy";
import { separar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import { Chat, type Pedido } from "./Chat";
import { Historial } from "./Historial";
import { PanelActividad } from "./PanelActividad";
import { PanelComentarios } from "./PanelComentarios";
import { PanelDetalle } from "./PanelDetalle";
import "./panel.css";

type Pestana = "detalle" | "actividad" | "comentarios";
const MAX_ACTIVIDAD = 30;

/** Primera línea de texto del cuerpo (fuera de títulos, listas y la sección Propuestas). */
function contexto(cuerpo: string): string | null {
  let enPropuestas = false;
  for (const linea of cuerpo.split(/\r?\n/)) {
    if (/^##\s/.test(linea)) enPropuestas = /^##\s+Propuestas/i.test(linea);
    const t = linea.trim();
    if (!enPropuestas && t && !/^(#|[-*] |>|\|)/.test(t)) return t;
  }
  return null;
}

/** Detalle de un archivo del repo: etiquetas, contexto, propuestas, inspiración, acciones y el chat de esa tarea. */
/** `enfocarChat`: cada valor nuevo lleva a Detalle y enfoca la entrada del chat ("Pedirle a Claude" del menú ⋯). */
export function Panel({ ruta, onCerrar, onEditar, animar = true, enfocarChat }: {
  ruta: string; onCerrar: () => void; onEditar?: (ruta: string) => void; animar?: boolean; enfocarChat?: number;
}) {
  const { indice } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido>();
  const [pestana, setPestana] = useState<Pestana>("detalle");
  const [historial, setHistorial] = useState(false);
  const commits = useCommits(ruta);
  const caja = useRef<HTMLElement>(null);
  useEffect(() => { caja.current?.focus(); }, [ruta]); // al abrir, el foco entra al panel
  const texto = useArchivo(ruta, onCerrar);
  useEffect(() => { setError(null); setPestana("detalle"); setHistorial(false); }, [ruta]);
  const [foco, setFoco] = useState(0);
  useEffect(() => {
    if (!enfocarChat) return;
    setPestana("detalle");
    setHistorial(false);
    setFoco(enfocarChat);
  }, [enfocarChat]);
  if (texto === null) return <aside ref={caja} tabIndex={-1} className="panel" aria-label="Detalle" />;
  const { meta, cuerpo } = separar(texto);
  const esEntregable = meta?.tipo === "entregable";
  const cliente = indice.clientes.find((c) => c.slug === meta?.cliente);
  const linea = contexto(cuerpo);
  const ver = esEntregable ? pestana : "detalle";

  return (
    <aside ref={caja} tabIndex={-1} className={animar ? "panel anima" : "panel"} aria-label={`Detalle de ${titulo(ruta)}`}>
      <div className="panel-cabeza">
        <Etiquetas meta={meta ?? {}} cliente={cliente?.nombre} color={colorPara(String(meta?.cliente ?? ""))} />
        <button className="x" onClick={onCerrar} aria-label="Cerrar detalle">×</button>
      </div>
      <h2>{titulo(ruta)}</h2>
      {linea && <p className="contexto">{linea}</p>}

      {esEntregable && (
        <Pestanas ver={ver} actividad={commits?.length} comentarios={comentarios(cuerpo).length}
          elegir={(k) => { setPestana(k); setHistorial(false); setPedido(undefined); setFoco(0); }} />
      )}
      {historial ? <Historial ruta={ruta} onVolver={() => setHistorial(false)} /> : (
        <div id="panel-pestana" className="pestana" {...(esEntregable && { role: "tabpanel", "aria-labelledby": `pestana-${ver}` })}>
          {ver === "actividad" && <PanelActividad commits={commits} onVerCambios={() => setHistorial(true)} />}
          {ver === "comentarios" && <PanelComentarios ruta={ruta} cuerpo={cuerpo} onError={setError} />}
          {ver === "detalle" && (
            <PanelDetalle key={ruta} ruta={ruta} meta={meta} cuerpo={cuerpo} onEditar={onEditar} onPedir={(t) => setPedido({ texto: t })} onError={setError} onBorrado={onCerrar} />
          )}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {ver === "detalle" && !historial && <Chat contextoId={ruta} contexto={ruta} etiqueta={titulo(ruta)} color={meta?.cliente ? colorPara(String(meta.cliente)) : undefined}
        formato={esEntregable ? String(meta?.formato ?? "") || undefined : undefined} pedido={pedido} onAbrir={onEditar} enfocar={foco} />}
    </aside>
  );
}

/** Texto de `ruta`, releído cuando cambia en disco (null mientras se lee). Cierra si no se puede leer o con Escape. */
function useArchivo(ruta: string, onCerrar: () => void): string | null {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => window.aos.repo.read(ruta).then((t) => vivo && setTexto(t), () => vivo && onCerrar());
    setTexto(null);
    void leer();
    const quitar = window.aos.repo.onCambio((rutas) => rutas.includes(ruta) && void leer());
    return () => { vivo = false; quitar(); };
  }, [ruta, onCerrar]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);
  return texto;
}

function Pestanas({ ver, actividad, comentarios, elegir }: {
  ver: Pestana; actividad?: number; comentarios: number; elegir: (p: Pestana) => void;
}) {
  const lista: [Pestana, string, number?][] = [["detalle", "Detalle"], ["actividad", "Actividad", actividad], ["comentarios", "Comentarios", comentarios]];
  return (
    <div className="pestanas" role="tablist" aria-label="Secciones de la tarea">
      {lista.map(([k, nombre, n]) => (
        <button key={k} id={`pestana-${k}`} role="tab" aria-selected={ver === k} aria-controls="panel-pestana" onClick={() => elegir(k)}>
          {nombre}{n !== undefined && <span className="c">{n}</span>}
        </button>
      ))}
    </div>
  );
}

/** Commits de la tarea (los últimos 30); se vuelven a pedir cuando el sync termina. null = aún preguntando. */
function useCommits(ruta: string): Commit[] | null {
  const [commits, setCommits] = useState<Commit[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const traer = () => window.aos.git.log({ ruta, max: MAX_ACTIVIDAD }).then((cs) => vivo && setCommits(cs), () => vivo && setCommits([]));
    setCommits(null);
    void traer();
    const quitar = window.aos.sync.onEstado((e) => e === "al-dia" && void traer());
    return () => { vivo = false; quitar(); };
  }, [ruta]);
  return commits;
}

export const ANILLO: Record<string, string> = {
  en_curso: "var(--en-curso)", revision: "var(--foco)", aprobado: "var(--avance)", cancelado: "var(--atraso)",
};
export const ESTADO: Record<string, string> = { en_curso: "en curso", revision: "revisión" };

function Etiquetas({ meta, cliente, color }: { meta: Record<string, unknown>; cliente?: string; color: string }) {
  const vence = meta.vence ? cuando(String(meta.vence), fechaLocal()) : null;
  const estado = meta.estado ? String(meta.estado) : null;
  return (
    <div className="chips">
      {meta.cliente != null && <span className="chip"><span className="dot" style={{ background: color }} aria-hidden />{cliente ?? String(meta.cliente)}</span>}
      {meta.formato != null && <span className="chip">{String(meta.formato)}</span>}
      {vence && (
        <span className={vence.tarde ? "chip tarde" : "chip"}>
          {vence.tarde && <span aria-hidden>▲</span>}{vence.tarde ? `vencía ${vence.texto}` : `vence ${vence.texto}`}
          {meta.fecha_tentativa === true && <span className="k">tentativa</span>}
        </span>
      )}
      {estado && (
        <span className="chip">
          <span className="anillo" style={{ borderColor: ANILLO[estado] }} aria-hidden />{ESTADO[estado] ?? estado}
        </span>
      )}
    </div>
  );
}
