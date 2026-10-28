import { Maximize2, Minimize2, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  aceptar, cancelar, deshacerTodo, enviar, olvidarOmitidos, recetas, type Turno, useAlgunoEnCurso, useConversacion, useOmitidos, useRevision,
} from "../datos/chat";
import { titulo } from "../datos/hoy";
import { type Bloque, bloques, type Estado } from "../datos/pasos";
import { useSesion } from "../datos/sesion";
import { ICONO as TAM } from "./Lateral";
import "./chat.css";

export type Pedido = { texto: string };
type Props = {
  contextoId: string; contexto: string; etiqueta: string; color?: string; formato?: string;
  /** Un mensaje que llega de afuera ("Desarrolla la propuesta 1"): se envía al llegar un objeto nuevo. */
  pedido?: Pedido; onAbrir?: (ruta: string) => void;
  /** En el cajón de la derecha: cerrar (⌘J) y pasar a pantalla completa (⌘⇧J). En pantalla completa: volver al costado (⌘⇧J). */
  onCerrar?: () => void; onAgrandar?: () => void; onAchicar?: () => void;
  /** Escape en el cajón: lo cierra sin guardar la preferencia (si falta, usa onCerrar). */
  onOcultar?: () => void;
  /** Enfoca la entrada al montar y cada vez que cambia a otro valor verdadero (un número sirve para volver a pedirlo). */
  enfocar?: boolean | number;
};

const ICONO: Record<Estado, string> = { ok: "✓", corriendo: "◐", error: "✕" };
const LEIDO: Record<Estado, string> = { ok: "listo", corriendo: "en curso", error: "falló" };

/** Conversación con Claude en un contexto (tarea, cliente o todo el espacio), según `chat.html`. */
export function Chat({ contextoId, contexto, etiqueta, color, formato, pedido, onAbrir, onCerrar, onAgrandar, onAchicar, onOcultar = onCerrar, enfocar = false }: Props) {
  const turnos = useConversacion(contextoId);
  const enCurso = Boolean(turnos.at(-1)?.enCurso);
  const claudeOcupado = useAlgunoEnCurso(); // un turno a la vez en toda la app
  const fin = useRef<HTMLDivElement>(null);
  const enviado = useRef<Pedido | undefined>(undefined);
  const [espera, setEspera] = useState(false); // pidieron algo mientras Claude seguía respondiendo
  const mandar = (texto: string) => {
    if (claudeOcupado) return setEspera(true);
    if (texto.trim()) enviar(contextoId, texto.trim(), contexto, etiqueta);
  };
  useEffect(() => { if (!claudeOcupado) setEspera(false); }, [claudeOcupado]);
  // Solo el texto final se anuncia; los pasos que cambian en vivo no.
  const final = enCurso ? "" : bloques(turnos.at(-1)?.eventos ?? []).filter((b) => b.tipo === "texto").at(-1);

  useEffect(() => {
    if (!pedido || enviado.current === pedido) return; // StrictMode corre el efecto dos veces
    enviado.current = pedido;
    mandar(pedido.texto);
  }, [pedido]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [turnos]);

  return (
    <section className={onCerrar ? "chat cajon" : onAchicar ? "chat ancho" : "chat"} aria-label="Chat con Claude"
      onKeyDown={(e) => { if (onOcultar && e.key === "Escape") { e.preventDefault(); onOcultar(); } }}>
      <div className="chat-cabeza">
        <span className="ctx">{color && <span className="dot" style={{ background: color }} aria-hidden />}{etiqueta}</span>
        {onCerrar || onAchicar ? (
          <span className="acc">
            {onAgrandar && <BotonIcono etiqueta="Pantalla completa (⌘⇧J)" onClick={onAgrandar}><Maximize2 size={TAM} aria-hidden /></BotonIcono>}
            {onAchicar && <BotonIcono etiqueta="Volver al costado (⌘⇧J)" onClick={onAchicar}><Minimize2 size={TAM} aria-hidden /></BotonIcono>}
            {onCerrar && <BotonIcono etiqueta="Cerrar (⌘J)" onClick={onCerrar}><X size={TAM} aria-hidden /></BotonIcono>}
          </span>
        ) : <span className="r">{contextoId === "global" ? "Conversación general" : "Conversación de este contexto"}</span>}
      </div>
      <div className="msgs">
        {turnos.length === 0 && <p className="vacio">Pídele algo a Claude: trabaja en el repo y lo ves cambiar en vivo.</p>}
        {turnos.map((t, k) => <TurnoVista key={k} turno={t} onAbrir={onAbrir} onDetener={() => cancelar(contextoId)} />)}
        {/* Siempre montado: los lectores de pantalla anuncian el cambio de texto. */}
        <p className={espera ? "trabajando" : "sr"} role="status">{espera ? "Espera a que Claude termine de responder; después vuelve a pedírselo." : ""}</p>
        <div ref={fin} />
      </div>
      <p className="sr" aria-live="polite">{final && final.tipo === "texto" ? final.texto : ""}</p>
      <BarraRevision />
      <Entrada enCurso={claudeOcupado} onEnviar={mandar} recetas={recetas(contexto, formato)} enfocar={enfocar} />
      {onCerrar && <p className="pista">Enter envía · ⌘J cierra · ⌘⇧J agranda</p>}
      {onAchicar && <p className="pista">Enter envía · ⌘⇧J vuelve al costado</p>}
    </section>
  );
}

/** Botón de solo ícono: el nombre con su atajo va en aria-label y en el tooltip. */
function BotonIcono({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: ReactNode }) {
  return <button className="x" onClick={onClick} aria-label={etiqueta} title={etiqueta}>{children}</button>;
}

function TurnoVista({ turno, onAbrir, onDetener }: { turno: Turno; onAbrir?: (ruta: string) => void; onDetener: () => void }) {
  const errores = turno.eventos.flatMap((e) => (e.tipo === "error" ? [e.texto] : []));
  return (
    <>
      <div className="yo">{turno.mensaje}</div>
      {bloques(turno.eventos).map((b, k) => <BloqueVista key={k} b={b} onAbrir={onAbrir} />)}
      {errores.map((e, k) => <p key={`${k}-${e}`} className="chat-error" role="alert">⚠ {e}</p>)}
      {turno.enCurso && (
        <p className="trabajando">
          <span className="run" aria-hidden>◐</span>Claude está trabajando…
          <button className="btn plano" onClick={onDetener}>Detener</button>
        </p>
      )}
    </>
  );
}

function BloqueVista({ b, onAbrir }: { b: Bloque; onAbrir?: (ruta: string) => void }) {
  if (b.tipo === "texto") return <div className="ia">{b.texto}</div>;
  if (b.tipo === "pasos") {
    return (
      <ul className="pasos" aria-label="Pasos">
        {b.pasos.map((p) => (
          <li key={p.id} className={p.estado}>
            <span className="ic" aria-hidden>{ICONO[p.estado]}</span>{p.texto}<span className="sr"> ({LEIDO[p.estado]})</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="aprob">
      <b>Esto necesita tu OK antes de salir</b>
      <p className="q">Dejé el borrador “{titulo(b.ruta)}” para que lo revises. No se envía nada hasta que lo apruebes.</p>
      {onAbrir && <button className="btn" onClick={() => onAbrir(b.ruta)}>Ver borrador</button>}
    </div>
  );
}

function Entrada({ enCurso, onEnviar, recetas: rs, enfocar }: {
  enCurso: boolean; onEnviar: (t: string) => void; recetas: { etiqueta: string; mensaje: string }[]; enfocar: boolean | number;
}) {
  const [texto, setTexto] = useState("");
  const caja = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (enfocar) caja.current?.focus(); }, [enfocar]);
  const id = useRef(`chat-${Math.random().toString(36).slice(2)}`).current;
  const enviarForm = (e?: FormEvent) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    onEnviar(texto); // si Claude está ocupado, el chat avisa que espere y no se envía
    if (enCurso) return; // el texto queda para mandarlo después
    setTexto("");
  };
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) enviarForm(e);
  };
  return (
    <form className="entrada" onSubmit={enviarForm}>
      <label className="sr" htmlFor={id}>Mensaje para Claude</label>
      <textarea ref={caja} id={id} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla}
        placeholder="Responde o pide un cambio…" />
      <div className="entrada-pie">
        <div className="recetas" aria-label="Atajos">
          {rs.map((r) => <button key={r.etiqueta} type="button" className="receta" aria-disabled={enCurso} onClick={() => onEnviar(r.mensaje)}>{r.etiqueta}</button>)}
        </div>
        <button className="btn pri" type="submit" aria-disabled={enCurso || !texto.trim()}>Enviar</button>
      </div>
    </form>
  );
}

/** "Aceptar / Deshacer todo" de lo que Claude cambió y nadie ha revisado. Va en el chat y en el documento abierto. */
export function BarraRevision({ ruta }: { ruta?: string }) {
  const revision = useRevision();
  const { persona } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const claudeTrabajando = useAlgunoEnCurso();
  const omitidos = useOmitidos();
  if (!revision) return <Omitidos rutas={ruta ? omitidos.filter((r) => r === ruta) : omitidos} />;
  const rutas = Object.keys(revision.archivos);
  if (ruta && !rutas.includes(ruta)) return null;
  const ocupado = deshaciendo || claudeTrabajando;
  const n = rutas.length;
  const deshacer = () => {
    if (ocupado) return;
    setDeshaciendo(true);
    setError(null);
    deshacerTodo(persona).catch((e: unknown) => setError(`No pude deshacer: ${e instanceof Error ? e.message : String(e)}`)).finally(() => setDeshaciendo(false));
  };
  return (
    <div className="revision" role="region" aria-label="Cambios de Claude">
      <span className="grow">
        <span className="marca-nuevo" aria-hidden />
        {ruta ? "Claude cambió este documento; lo nuevo está marcado." : `Claude cambió ${n === 1 ? "1 archivo" : `${n} archivos`}: ${rutas.map(titulo).join(", ")}.`}
      </span>
      {error && <span className="chat-error" role="alert">⚠ {error}</span>}
      <button className="btn" aria-disabled={ocupado} onClick={deshacer}>{deshaciendo ? "Deshaciendo…" : "Deshacer todo"}</button>
      <button className="btn pri" aria-disabled={ocupado} onClick={() => !ocupado && aceptar()}>Aceptar</button>
    </div>
  );
}

/** Lo que Deshacer no tocó porque otra persona lo cambió después. */
function Omitidos({ rutas }: { rutas: string[] }) {
  if (!rutas.length) return null;
  return (
    <div className="revision omitidos" role="alert">
      <span className="grow">{rutas.map((r) => <span key={r} className="omitido">⚠ No deshice {titulo(r)}: alguien más lo cambió después.</span>)}</span>
      <button className="x" aria-label="Cerrar aviso" onClick={olvidarOmitidos}>×</button>
    </div>
  );
}
