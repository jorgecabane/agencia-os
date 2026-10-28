import { type ReactNode, useState } from "react";
import { agregarCasilla, alternarCasilla, checklist } from "../datos/checklist";
import { clienteDeRuta, titulo } from "../datos/hoy";
import { cambiarCuerpo, cambiar as cambiarFm } from "../datos/md";
import { inspiracion, propuestas } from "../datos/propuestas";
import { useSesion } from "../datos/sesion";

type Abierto = "reagendar" | "asignar" | "borrar" | "casilla" | null;

// La UI se sirve desde <repo>/app/ui-dist/: las imágenes del repo quedan dos carpetas arriba.
const BASE_REPO = location.pathname.includes("/app/ui-dist/") ? "../../" : null;
const NO_GUARDO = "No se pudo guardar el cambio. Revisa que el archivo se pueda leer.";

type Props = {
  ruta: string; meta: Record<string, unknown> | null; cuerpo: string;
  onEditar?: (ruta: string) => void; onPedir: (texto: string) => void; onError: (msg: string) => void; onBorrado: () => void;
};

/** Pestaña Detalle del panel: checklist (entregables), propuestas, inspiración, acciones y sus formularios. */
export function PanelDetalle({ ruta, meta, cuerpo, onEditar, onPedir, onError, onBorrado }: Props) {
  const { indice } = useSesion();
  const [elegida, setElegida] = useState(0);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const esEntregable = meta?.tipo === "entregable";
  const props = propuestas(cuerpo).sort((a, b) => Number(b.recomendada) - Number(a.recomendada));
  const insp = inspiracion(props.map((p) => p.texto), clienteDeRuta(ruta) ?? "");

  const cambiar = (cambios: Record<string, unknown>) => cambiarFm(ruta, cambios).then(() => setAbierto(null), () => onError(NO_GUARDO));
  const borrar = () => window.aos.repo.delete(ruta).then(onBorrado, () => onError("No se pudo borrar."));
  const cambiarTexto = (f: (cuerpo: string) => string) => cambiarCuerpo(ruta, f).catch(() => onError(NO_GUARDO));

  return (
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
            onClick={() => props[elegida] && onPedir(`Desarrolla la propuesta ${elegida + 1} (“${props[elegida].texto}”)`)}
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
        <Formulario etiqueta="Nueva fecha" onCancelar={() => setAbierto(null)} onGuardar={(v) => cambiar({ vence: v, fecha_tentativa: undefined })}>
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
  );
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
