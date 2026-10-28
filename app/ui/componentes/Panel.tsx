import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Commit } from "../../shared/puente";
import { alternarCasilla, agregarCasilla, checklist } from "../datos/checklist";
import { comentarios } from "../datos/comentarios";
import { clienteDeRuta, colorPara, cuando, fechaLocal, titulo } from "../datos/hoy";
import { cambiarCuerpo, cambiar as cambiarFm, separar } from "../datos/md";
import { inspiracion, propuestas } from "../datos/propuestas";
import { useSesion } from "../datos/sesion";
import { Chat, type Pedido } from "./Chat";
import { Historial } from "./Historial";
import { PanelActividad } from "./PanelActividad";
import { PanelComentarios } from "./PanelComentarios";
import "./panel.css";

type Abierto = "reagendar" | "asignar" | "borrar" | "casilla" | null;
type Pestana = "detalle" | "actividad" | "comentarios";
const MAX_ACTIVIDAD = 30;

// La UI se sirve desde <repo>/app/ui-dist/: las imágenes del repo quedan dos carpetas arriba.
const BASE_REPO = location.pathname.includes("/app/ui-dist/") ? "../../" : null;

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
export function Panel({ ruta, onCerrar, onEditar, animar = true }: {
  ruta: string; onCerrar: () => void; onEditar?: (ruta: string) => void; animar?: boolean;
}) {
  const { indice } = useSesion();
  const [texto, setTexto] = useState<string | null>(null);
  const [elegida, setElegida] = useState(0);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido>();
  const [pestana, setPestana] = useState<Pestana>("detalle");
  const [historial, setHistorial] = useState(false);
  const commits = useCommits(ruta);
  const caja = useRef<HTMLElement>(null);
  useEffect(() => { caja.current?.focus(); }, [ruta]); // al abrir, el foco entra al panel

  useEffect(() => {
    let vivo = true;
    const leer = () => window.aos.repo.read(ruta).then((t) => vivo && setTexto(t), () => vivo && onCerrar());
    setTexto(null); setElegida(0); setAbierto(null); setError(null); setPestana("detalle"); setHistorial(false);
    void leer();
    const quitar = window.aos.repo.onCambio((rutas) => rutas.includes(ruta) && void leer());
    return () => { vivo = false; quitar(); };
  }, [ruta, onCerrar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  if (texto === null) return <aside ref={caja} tabIndex={-1} className="panel" aria-label="Detalle" />;
  const { meta, cuerpo } = separar(texto);
  const esEntregable = meta?.tipo === "entregable";
  const props = propuestas(cuerpo).sort((a, b) => Number(b.recomendada) - Number(a.recomendada));
  const insp = inspiracion(props.map((p) => p.texto), clienteDeRuta(ruta) ?? "");
  const cliente = indice.clientes.find((c) => c.slug === meta?.cliente);
  const linea = contexto(cuerpo);

  const cambiar = async (cambios: Record<string, unknown>) => {
    try {
      await cambiarFm(ruta, cambios);
      setAbierto(null);
    } catch {
      setError("No se pudo guardar el cambio. Revisa que el archivo se pueda leer.");
    }
  };
  const borrar = () => window.aos.repo.delete(ruta).then(onCerrar, () => setError("No se pudo borrar."));
  const cambiarTexto = (f: (cuerpo: string) => string) =>
    cambiarCuerpo(ruta, f).catch(() => setError("No se pudo guardar el cambio. Revisa que el archivo se pueda leer."));
  const pestanas: [Pestana, string, number?][] = [
    ["detalle", "Detalle"], ["actividad", "Actividad", commits?.length], ["comentarios", "Comentarios", comentarios(cuerpo).length],
  ];
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
        <div className="pestanas" role="tablist" aria-label="Secciones de la tarea">
          {pestanas.map(([k, nombre, n]) => (
            <button key={k} id={`pestana-${k}`} role="tab" aria-selected={ver === k} aria-controls="panel-pestana" onClick={() => { setPestana(k); setHistorial(false); }}>
              {nombre}{n !== undefined && <span className="c">{n}</span>}
            </button>
          ))}
        </div>
      )}
      {historial ? <Historial ruta={ruta} onVolver={() => setHistorial(false)} /> : (
        <div id="panel-pestana" className="pestana" {...(esEntregable && { role: "tabpanel", "aria-labelledby": `pestana-${ver}` })}>
          {ver === "actividad" && <PanelActividad commits={commits} onVerCambios={() => setHistorial(true)} />}
          {ver === "comentarios" && <PanelComentarios ruta={ruta} cuerpo={cuerpo} onError={setError} />}
          {ver === "detalle" && (
            <>
            {esEntregable && (
              <Checklist cuerpo={cuerpo} onAlternar={(c) => void cambiarTexto((b) => (igual(b, c) ? alternarCasilla(b, c.linea) : b))} onAgregar={() => setAbierto("casilla")} />
            )}
            {abierto === "casilla" && (
              <Formulario etiqueta="Nueva casilla" onCancelar={() => setAbierto(null)} onGuardar={(v) => { setAbierto(null); void cambiarTexto((b) => agregarCasilla(b, v)); }}>
                {(id) => <input id={id} name="valor" required autoFocus />}
              </Formulario>
            )}

            {props.length > 0 && (
              <div className="props" role="radiogroup" aria-label="Propuestas">
                {props.map((p, k) => (
                  <button key={p.texto} className="prop" role="radio" aria-checked={k === elegida} onClick={() => setElegida(k)}>
                    <span className="n">Propuesta {k + 1}{p.recomendada && <span className="rec">✦ recomendada</span>}</span>
                    {p.texto}
                  </button>
                ))}
              </div>
            )}
            {esEntregable && props.length === 0 && <p className="vacio">Aún no hay propuestas para esta tarea.</p>}

            {insp.length > 0 && (
              <>
                <h3 className="subtitulo">Inspiración</h3>
                <div className="insp">
                  {insp.map((x) =>
                    x.tipo === "imagen" && BASE_REPO
                      ? <img key={x.ruta} src={BASE_REPO + x.ruta} alt={titulo(x.ruta)} />
                      : <span key={x.tipo === "link" ? x.url : x.ruta} className="insp-link">{x.tipo === "link" ? x.url : x.ruta}</span>,
                  )}
                </div>
            </>
          )}

          <div className="acciones">
            {esEntregable && (
              <button
                className="btn pri" aria-disabled={props.length === 0}
                onClick={() => props[elegida] && setPedido({ texto: `Desarrolla la propuesta ${elegida + 1} (“${props[elegida].texto}”)` })}
              >
                {props.length ? `Desarrollar la ${elegida + 1}` : "Desarrollar"}
              </button>
            )}
            {onEditar && <button className="btn" onClick={() => onEditar(ruta)}>Editar</button>}
            {esEntregable && <button className="btn" aria-expanded={abierto === "reagendar"} onClick={() => setAbierto("reagendar")}>Reagendar</button>}
            {esEntregable && <button className="btn" aria-expanded={abierto === "asignar"} onClick={() => setAbierto("asignar")}>Asignar</button>}
            <button className="btn" aria-expanded={abierto === "borrar"} onClick={() => setAbierto("borrar")}>Borrar</button>
          </div>

          {abierto === "reagendar" && (
            <Formulario etiqueta="Nueva fecha" onCancelar={() => setAbierto(null)} onGuardar={(v) => cambiar({ vence: v })}>
              {(id) => <input id={id} name="valor" type="date" defaultValue={String(meta?.vence ?? "")} required autoFocus />}
            </Formulario>
          )}
          {abierto === "asignar" && (
            <Formulario etiqueta="Responsable" onCancelar={() => setAbierto(null)} onGuardar={(v) => cambiar({ responsable: v })}>
              {(id) => (
                <select id={id} name="valor" defaultValue={String(meta?.responsable ?? "")} autoFocus>
                  {indice.personas.map((p) => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
                  <option value="ia">Claude (ia)</option>
                </select>
              )}
            </Formulario>
          )}
          {abierto === "borrar" && (
            <div
              className="formulario" role="alertdialog" aria-label="Confirmar borrado"
              onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setAbierto(null); } }}
            >
              <span>¿Borrar este archivo? Queda en el historial de git.</span>
              <button className="btn peligro" onClick={() => void borrar()} autoFocus>Sí, borrar</button>
              <button className="btn plano" onClick={() => setAbierto(null)}>Cancelar</button>
            </div>
          )}
            </>
          )}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <Chat contextoId={ruta} contexto={ruta} etiqueta={titulo(ruta)} color={meta?.cliente ? colorPara(String(meta.cliente)) : undefined}
        formato={esEntregable ? String(meta?.formato ?? "") || undefined : undefined} pedido={pedido} onAbrir={onEditar} />
    </aside>
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

type Casilla = ReturnType<typeof checklist>[number];
/** La casilla sigue en su línea, con el mismo texto y estado (si no, otro la cambió y no se toca). */
const igual = (cuerpo: string, c: Casilla) => checklist(cuerpo).some((x) => x.linea === c.linea && x.texto === c.texto && x.hecho === c.hecho);

function Checklist({ cuerpo, onAlternar, onAgregar }: { cuerpo: string; onAlternar: (c: Casilla) => void; onAgregar: () => void }) {
  const casillas = checklist(cuerpo);
  return (
    <section className="checklist" aria-label="Checklist">
      <div className="sub-t">
        <h3 className="subtitulo">Checklist</h3>
        {casillas.length > 0 && <span>{casillas.filter((c) => c.hecho).length} de {casillas.length}</span>}
      </div>
      <ul>
        {casillas.map((c) => (
          <li key={c.linea}>
            <input type="checkbox" id={`casilla-${c.linea}`} checked={c.hecho} onChange={() => onAlternar(c)} />
            <label htmlFor={`casilla-${c.linea}`} className={c.hecho ? "hecho" : undefined}>{c.texto}</label>
          </li>
        ))}
      </ul>
      <button className="btn plano agregar" onClick={onAgregar}>+ Agregar</button>
    </section>
  );
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

function Formulario({ etiqueta, children, onGuardar, onCancelar }: {
  etiqueta: string; children: (id: string) => ReactNode; onGuardar: (valor: string) => void; onCancelar: () => void;
}) {
  const id = `campo-${etiqueta.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <form
      className="formulario"
      onSubmit={(e) => { e.preventDefault(); onGuardar(String(new FormData(e.currentTarget).get("valor"))); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancelar(); } }}
    >
      <label htmlFor={id}>{etiqueta}</label>
      {children(id)}
      <button className="btn pri" type="submit">Guardar</button>
      <button className="btn plano" type="button" onClick={onCancelar}>Cancelar</button>
    </form>
  );
}
