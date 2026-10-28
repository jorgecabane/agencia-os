import { ListChecks, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ICONO } from "../componentes/Lateral";
import { colorPara, cuando, horaDe, titulo } from "../datos/hoy";
import { cambiar, separar } from "../datos/md";
import { promesasDeActa } from "../datos/promesas";
import { confirmarActa, deActa } from "../datos/revision";
import { useSesion } from "../datos/sesion";
import type { Entregable, Promesa, Reunion } from "../datos/tipos";
import "./revisar.css";

const FUENTES: Record<string, string> = { granola: "desde Granola", notas: "desde notas", transcripcion: "desde transcripción" };
const CORREGIR = "Revisa el acta y corrige las tareas, responsables y fechas que no calcen con lo que se habló.";
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Props = {
  ruta: string; fecha: string; onVolver: () => void; onEditar: (ruta: string) => void;
  onPedirClaude: (texto: string, contexto: string) => void;
};

/** Promesas del cliente anotadas en el acta (el índice no lee cuerpos). */
function useDebeCliente(acta: Reunion | undefined): Promesa[] {
  const { indice } = useSesion();
  const [ps, setPs] = useState<Promesa[]>([]);
  useEffect(() => {
    if (!acta) return;
    let vivo = true;
    const slugs = new Set(indice.personas.map((p) => p.slug));
    void window.aos.repo.read(acta.ruta).then((t) => {
      if (vivo) setPs(promesasDeActa(acta, separar(t).cuerpo, slugs).promesas.filter((p) => p.delCliente));
    }, () => undefined);
    return () => { vivo = false; };
  }, [indice, acta?.ruta]);
  return ps;
}

export function RevisarActa({ ruta, fecha, onVolver, onEditar, onPedirClaude }: Props) {
  const { indice } = useSesion();
  const acta = indice.reuniones.find((r) => r.ruta === ruta);
  const debe = useDebeCliente(acta);
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (!acta) {
    return <main className="principal"><button className="btn plano" onClick={onVolver}>‹ Volver a Hoy</button><p className="vacio">Esta acta ya no existe.</p></main>;
  }
  const { tareas: todas, decisiones } = deActa(indice, acta);
  const tareas = todas.filter((e) => e.estado !== "cancelado");
  const n = tareas.length - descartadas.size;
  const alternar = (r: string) => setDescartadas((s) => { const x = new Set(s); if (!x.delete(r)) x.add(r); return x; });
  const confirmar = async () => {
    setGuardando(true);
    try { await confirmarActa(acta, [...descartadas]); onVolver(); }
    catch { setError("No pude guardar la revisión. Inténtalo de nuevo."); setGuardando(false); }
  };
  return (
    <main className="principal revisar">
      <button className="btn plano" onClick={onVolver}>‹ Volver a Hoy</button>
      <h1 className="titulo">{titulo(acta.ruta)}</h1>
      <Cabeza acta={acta} fecha={fecha} />
      <div className="dos">
        <div>
          <Subtitulo texto="Tareas que salieron" n={tareas.length} nota="tilda las que quedan" />
          {tareas.length > 0 && <ul className="revisa">{tareas.map((e) => (
            <FilaTarea key={e.ruta} e={e} marcada={!descartadas.has(e.ruta)} onAlternar={() => alternar(e.ruta)} onError={setError} />
          ))}</ul>}
          <DebeCliente debe={debe} fecha={fecha} />
        </div>
        <div>
          {decisiones.length > 0 && <>
            <Subtitulo texto="Decisiones" n={decisiones.length} />
            <ul className="revisa">{decisiones.map((d) => <li key={d.ruta} className="f"><span>{titulo(d.ruta)}</span></li>)}</ul>
          </>}
          {error && <p role="alert" className="error">{error}</p>}
          <div className="acciones">
            <button className="btn pri" disabled={guardando} onClick={() => void confirmar()}>
              <ListChecks size={ICONO} aria-hidden />{tareas.length ? `Confirmar y crear ${plural(n, "tarea", "tareas")}` : "Marcar como revisada"}
            </button>
            <button className="btn" onClick={() => onEditar(acta.ruta)}>Ver acta completa</button>
            <button className="btn" onClick={() => onPedirClaude(CORREGIR, acta.ruta)}><Sparkles size={ICONO} aria-hidden />Corregir con Claude</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Cabeza({ acta, fecha }: { acta: Reunion; fecha: string }) {
  const { indice } = useSesion();
  const nombre = (slug: string) => (indice.personas.find((p) => p.slug === slug)?.nombre ?? slug).split(" ")[0];
  const cliente = indice.clientes.find((c) => c.slug === acta.cliente)?.nombre ?? acta.cliente;
  const partes = [cliente, `${cuando(acta.fecha, fecha).texto} ${horaDe(acta.fecha)}`.trim()];
  if (acta.asistentes?.length) partes.push(acta.asistentes.map(nombre).join(", "));
  if (acta.fuente && FUENTES[acta.fuente]) partes.push(FUENTES[acta.fuente]);
  return <p className="bajada"><span className="dot" style={{ background: colorPara(acta.cliente) }} aria-hidden /> {partes.join(" · ")}</p>;
}

function DebeCliente({ debe, fecha }: { debe: Promesa[]; fecha: string }) {
  if (!debe.length) return null;
  return <>
    <Subtitulo texto="Lo que nos debe el cliente" n={debe.length} />
    <ul className="revisa">{debe.map((p) => (
      <li key={p.que} className="f"><span>{p.que[0].toUpperCase() + p.que.slice(1)}<span className="s">{p.quien} · {p.fecha ? cuando(p.fecha, fecha).texto : "sin fecha"}</span></span></li>
    ))}</ul>
  </>;
}

function Subtitulo({ texto, n, nota }: { texto: string; n: number; nota?: string }) {
  return <h2 className="sub-r"><span>{texto} <b>{n}</b></span>{nota && <span>{nota}</span>}</h2>;
}

/** Casilla local hasta confirmar; responsable y fecha se guardan al tiro. */
function FilaTarea({ e, marcada, onAlternar, onError }: { e: Entregable; marcada: boolean; onAlternar: () => void; onError: (m: string) => void }) {
  const { indice } = useSesion();
  const t = titulo(e.ruta);
  const guardar = (cambios: Record<string, unknown>) => void cambiar(e.ruta, cambios).catch(() => onError(`No pude guardar el cambio en "${t}".`));
  const personas = [...indice.personas.map((p) => ({ slug: p.slug, nombre: p.nombre })), { slug: "ia", nombre: "Claude" }];
  if (!personas.some((p) => p.slug === e.responsable)) personas.push({ slug: e.responsable, nombre: e.responsable });
  return (
    <li className={marcada ? "f" : "f descartada"}>
      <input type="checkbox" id={`r-${e.ruta}`} checked={marcada} onChange={onAlternar} />
      <span>
        <label htmlFor={`r-${e.ruta}`}>{t}</label>
        <span className="s formulario">
          <label className="oculto" htmlFor={`resp-${e.ruta}`}>Responsable de {t}</label>
          <select id={`resp-${e.ruta}`} value={e.responsable} onChange={(ev) => guardar({ responsable: ev.target.value })}>
            {personas.map((p) => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
          </select>
          <label className="oculto" htmlFor={`vence-${e.ruta}`}>Fecha de {t}</label>
          <input type="date" id={`vence-${e.ruta}`} defaultValue={String(e.vence).slice(0, 10)}
            onChange={(ev) => ev.target.value && guardar({ vence: ev.target.value })} />
          {e.fecha_tentativa && <span className="tentativa">fecha por confirmar</span>}
        </span>
      </span>
      <span className="chip">{marcada ? "se crea" : "no se crea"}</span>
    </li>
  );
}
