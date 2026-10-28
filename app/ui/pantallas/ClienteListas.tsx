import { ClockAlert, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ICONO } from "../componentes/Lateral";
import { porMes, sinContacto, sumarDias, textoContacto, UMBRAL_DIAS } from "../datos/contacto";
import { diaDe, titulo } from "../datos/hoy";
import { cambiar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import type { Indice } from "../datos/indice";
import type { Cliente as Ficha } from "../datos/tipos";
import { Estado, Fila, type Lista } from "./ClienteResumen";
import "./cliente.css";

const CERRADOS = new Set(["publicado", "cancelado"]);
type Item = { ruta: string; f: string; der: ReactNode; sub?: string; alerta: boolean };

/** Bajo la cabeza: hace cuánto no hablamos con el cliente (ver `sinContacto`). */
export function AlertaContacto({ ficha, fecha, onPedirClaude }: { ficha: Ficha; fecha: string; onPedirClaude?: (texto: string) => void }) {
  const { indice } = useSesion();
  const [error, setError] = useState(false);
  const a = sinContacto(indice, ficha.slug, fecha);
  if (!a) return null;
  const yaHablamos = () => {
    setError(false);
    void cambiar(ficha.ruta, { proximo_contacto: sumarDias(fecha, UMBRAL_DIAS) }).catch(() => setError(true));
  };
  const correo = `Prepara un correo para retomar el contacto con ${ficha.nombre}: resume lo último que hablamos y propón un próximo paso. Déjalo como borrador para aprobar.`;
  return (
    <div className="alerta-contacto" role="status">
      <ClockAlert size={ICONO} aria-hidden />
      <span className="grow">{textoContacto(a)}{error && <span className="error"> No pude guardar la fecha.</span>}</span>
      {onPedirClaude && <button className="btn" onClick={() => onPedirClaude(correo)}>Pedirle a Claude un correo</button>}
      <button className="btn plano" onClick={yaHablamos}>Ya hablamos</button>
    </div>
  );
}

function Segmento({ opciones, elegido, onElegir, label }: { opciones: string[]; elegido: number; onElegir: (i: number) => void; label: string }) {
  return (
    <div className="segmento" role="radiogroup" aria-label={label}>
      {opciones.map((o, i) => <button key={o} role="radio" aria-checked={i === elegido} onClick={() => onElegir(i)}>{o}</button>)}
    </div>
  );
}

/** Las filas de la lista y su segmento; `segundo` = Cerrados o Pasadas. */
function filas(indice: Indice, cual: Lista, slug: string, fecha: string, segundo: boolean): { items: Item[]; opciones: string[]; nota: string } {
  const nombre = (s: string) => (s === "ia" ? "Claude" : indice.personas.find((p) => p.slug === s)?.nombre ?? s);
  if (cual === "entregables") {
    const es = indice.entregables.filter((e) => e.cliente === slug);
    const n = es.filter((e) => CERRADOS.has(e.estado)).length;
    return {
      opciones: [`Abiertos ${es.length - n}`, `Cerrados ${n}`],
      nota: segundo ? "Publicados y cancelados, lo más reciente arriba" : "",
      items: es.filter((e) => CERRADOS.has(e.estado) === segundo).map((e) => ({
        ruta: e.ruta, f: e.vence, der: <Estado estado={e.estado} />, sub: `${nombre(e.responsable)} · ${e.formato}`, alerta: !segundo,
      })),
    };
  }
  if (cual === "reuniones") {
    const rs = indice.reuniones.filter((r) => r.cliente === slug);
    const pasada = (f: string) => diaDe(f) < fecha;
    const n = rs.filter((r) => pasada(r.fecha)).length;
    return {
      opciones: [`Próximas ${rs.length - n}`, `Pasadas ${n}`],
      nota: segundo ? "Lo más reciente arriba" : "",
      items: rs.filter((r) => pasada(r.fecha) === segundo).map((r) => ({
        ruta: r.ruta, f: r.fecha, alerta: false, der: <span className="st">{r.tipo === "brief-reunion" ? "Brief" : "Acta"}</span>,
      })),
    };
  }
  const items = indice.decisiones.filter((d) => d.cliente === slug).map((d) => ({ ruta: d.ruta, f: d.fecha, der: null, alerta: false }));
  return { items, opciones: [], nota: "" };
}

/** Entregables (Abiertos / Cerrados), Reuniones (Próximas / Pasadas) y Decisiones, agrupadas por mes. */
export function ListaCliente({ cual, slug, fecha, abrir, onNuevaTarea }: {
  cual: Lista; slug: string; fecha: string; abrir: (r: string) => void; onNuevaTarea?: () => void;
}) {
  const { indice } = useSesion();
  const [seg, setSeg] = useState(0);
  const { items, opciones, nota } = filas(indice, cual, slug, fecha, Boolean(seg));
  // Abiertos y Próximas: lo que viene primero. Cerrados, Pasadas y Decisiones: lo más reciente arriba.
  const grupos = porMes(items, (x) => x.f, cual === "decisiones" || Boolean(seg));
  const vacio = cual === "decisiones" ? "Todavía no hay decisiones." : `No hay ${opciones[seg].replace(/ \d+$/, "").toLowerCase()}.`;
  return (
    <>
      {opciones.length > 0 && (
        <div className="barra-lista">
          <Segmento opciones={opciones} elegido={seg} onElegir={setSeg} label={cual === "entregables" ? "Entregables" : "Reuniones"} />
          {nota && <span className="nota">{nota}</span>}
          {cual === "entregables" && onNuevaTarea && (
            <button className="btn nueva-tarea" onClick={onNuevaTarea}><Plus size={ICONO} aria-hidden />Nueva tarea<kbd className="atajo">⌘N</kbd></button>
          )}
        </div>
      )}
      {!grupos.length && <p className="vacio">{vacio}</p>}
      {grupos.map((g) => (
        <section key={g.mes}>
          <h3 className="mes">{g.mes}</h3>
          <ul className="lista">{g.items.map((x) => (
            <Fila key={x.ruta} cuandoF={x.f} fecha={fecha} t={titulo(x.ruta)} sub={x.sub} derecha={x.der} onClick={() => abrir(x.ruta)} alerta={x.alerta} />
          ))}</ul>
        </section>
      ))}
    </>
  );
}
