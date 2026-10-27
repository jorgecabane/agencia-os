import { type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Estado } from "../../shared/puente";
import { ESTADO } from "../componentes/Panel";
import { agenda, avisosPendientes, cuentaRegresiva, nombreCliente, siguienteEstado } from "../datos/agenda";
import { colorPara, fechaLocal, titulo } from "../datos/hoy";
import type { Indice } from "../datos/indice";
import { cambiar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import type { Entregable, Reunion } from "../datos/tipos";
import "./barra.css";

const MINUTO_MS = 60_000;
const SIN_CASILLA = new Set(["aprobado", "publicado", "cancelado"]); // la casilla nunca marca publicado (R17)
const PAUSA_MS = 60 * MINUTO_MS;
const SYNC: Record<Estado, { icono: string; texto: string; clase: string }> = {
  "al-dia": { icono: "●", texto: "Al día", clase: "ok" },
  subiendo: { icono: "↻", texto: "Sincronizando…", clase: "" },
  "sin-conexion": { icono: "⚠", texto: "Sin conexión", clase: "tarde" },
  conflicto: { icono: "⚠", texto: "Conflicto", clase: "tarde" },
};
const leido = (estado: string) => ESTADO[estado] ?? estado;
const hora = (fecha: string) => String(fecha).slice(11, 16) || "hoy";
const cerrar = () => window.close(); // el shell la oculta en vez de cerrarla

/** La hora actual, al minuto y al mostrar la ventana. */
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const tic = () => setAhora(new Date());
    const t = setInterval(tic, MINUTO_MS);
    window.addEventListener("focus", tic);
    return () => { clearInterval(t); window.removeEventListener("focus", tic); };
  }, []);
  return ahora;
}

/** Número del ícono y avisos del sistema; el shell descarta los ya avisados, los apagados y los en pausa. */
function useAvisos(indice: Indice, persona: string, ahora: Date, pendientes: number, atrasado: boolean): void {
  useEffect(() => window.aos.sistema.icono(pendientes, atrasado), [pendientes, atrasado]);
  useEffect(() => {
    let vivo = true;
    void Promise.all([window.aos.config.leer(), window.aos.repo.list("bandeja/*.md")]).then(([c, bandejas]) => {
      if (!vivo) return;
      avisosPendientes(indice, persona, ahora, new Set(c.yaAvisados), bandejas).forEach(window.aos.sistema.notificar);
    }, () => {});
    return () => { vivo = false; };
  }, [indice, persona, ahora]);
}

/** La ventana mide lo que su contenido. */
function useAlto() {
  const raiz = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = new ResizeObserver(() => window.aos.sistema.alto(el.offsetHeight));
    medir.observe(el);
    return () => medir.disconnect();
  }, []);
  return raiz;
}

/** Lo que se abre al hacer clic en el ícono de la barra de menú (`mockups-app/barra.html`). */
export function Barra() {
  const { indice, persona } = useSesion();
  const ahora = useAhora();
  const a = agenda(indice, persona, ahora);
  useAvisos(indice, persona, ahora, a.pendientes, a.atrasado);
  const raiz = useAlto();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const cliente = (slug: string) => nombreCliente(indice, slug);
  const aprobaciones = indice.aprobaciones.filter((x) => x.persona === persona && x.estado === "pendiente");
  const abrir = (ruta?: string) => window.aos.sistema.principal(ruta);
  return (
    <main ref={raiz} className="mb">
      {a.proxima && <Proxima r={a.proxima} ahora={ahora} cliente={cliente(a.proxima.cliente)} onAbrir={abrir} />}
      <MasTarde reuniones={a.masTarde} cliente={cliente} onAbrir={abrir} />
      <hr className="sep" />
      <Seccion titulo="Mis entregas de hoy">
        {a.entregas.length === 0 && <p className="vacio-mb">Nada vence hoy.</p>}
        {a.entregas.map((e) => <EntregaFila key={e.ruta} e={e} cliente={cliente(e.cliente)} fecha={fechaLocal(ahora)} onAbrir={abrir} />)}
      </Seccion>
      <hr className="sep" />
      {aprobaciones.length > 0 && (
        <button className="row" onClick={() => abrir(aprobaciones[0].ruta)}>
          <span className="txt">{aprobaciones.length === 1 ? "1 aprobación esperando" : `${aprobaciones.length} aprobaciones esperando`}</span>
          <span className="r">ver</span>
        </button>
      )}
      <Captura />
      <hr className="sep" />
      <button className="row" onClick={() => abrir()}>
        <span className="txt">Abrir agencia-os</span><span className="r"><kbd>⌘ O</kbd></span>
      </button>
      <Pie ahora={ahora} />
    </main>
  );
}

function Seccion({ titulo: t, children }: { titulo: string; children: ReactNode }) {
  return <section aria-label={t}><h2 className="sec">{t}</h2>{children}</section>;
}

function Proxima({ r, ahora, cliente, onAbrir }: { r: Reunion; ahora: Date; cliente: string; onAbrir: (ruta: string) => void }) {
  return (
    <Seccion titulo="Próxima reunión">
      <div className="next">
        <p className="when">{cuentaRegresiva(r.fecha, ahora)}</p>
        <p className="t">{titulo(r.ruta)} · {cliente}</p>
        <p className="s">{r.tipo === "brief-reunion" ? "Brief listo" : "Todavía sin brief"} · {hora(r.fecha)}</p>
        <div className="acts">
          <button className="b pri" onClick={() => onAbrir(r.ruta)}>Abrir brief</button>
          {r.link?.startsWith("https://") && <button className="b" onClick={() => void window.aos.sistema.abrir(r.link!).then(cerrar, () => {})}>Unirme</button>}
        </div>
      </div>
    </Seccion>
  );
}

function MasTarde({ reuniones, cliente, onAbrir }: { reuniones: Reunion[]; cliente: (slug: string) => string; onAbrir: (ruta: string) => void }) {
  if (!reuniones.length) return null;
  return (
    <Seccion titulo="Más tarde hoy">
      {reuniones.map((r) => (
        <button key={r.ruta} className="row" onClick={() => onAbrir(r.ruta)}>
          <span className="h">{hora(r.fecha)}</span>
          <span className="dot" style={{ background: colorPara(r.cliente) }} aria-hidden />
          <span className="txt">{titulo(r.ruta)} · {cliente(r.cliente)}</span>
          {r.tipo === "brief-reunion" && <span className="r">brief listo</span>}
        </button>
      ))}
    </Seccion>
  );
}

/** Casilla "listo": avanza la entrega al siguiente estado (`siguienteEstado`), escribiendo solo `estado`. */
function EntregaFila({ e, cliente, fecha, onAbrir }: { e: Entregable; cliente: string; fecha: string; onAbrir: (r: string) => void }) {
  const [error, setError] = useState(false);
  const sig = siguienteEstado(e);
  const tarde = String(e.vence) < fecha;
  const avanzar = () => { setError(false); cambiar(e.ruta, { estado: sig }).catch(() => setError(true)); };
  return (
    <div className="row ent">
      {SIN_CASILLA.has(e.estado)
        ? <span className="chk-no" aria-hidden />
        : <button className="chk" onClick={avanzar} aria-label={`Pasar ${titulo(e.ruta)} a ${leido(sig)}`} title={`Pasar a ${leido(sig)}`} />}
      <button className="txt link" onClick={() => onAbrir(e.ruta)}>{titulo(e.ruta)} · {cliente}</button>
      {error
        ? <span className="r tarde" role="alert">⚠ no se guardó</span>
        : <span className={tarde ? "r tarde" : "r"}>{tarde ? <><span aria-hidden>▲ </span>atrasado</> : leido(e.estado)}</span>}
    </div>
  );
}

/** "Anotar algo rápido": va al chat de "Todo el espacio" en la ventana principal. ⌥Espacio la enfoca. */
function Captura() {
  const [texto, setTexto] = useState("");
  const [espera, setEspera] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => window.aos.sistema.onCaptura(() => campo.current?.focus()), []);
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    if (!texto.trim()) return;
    void window.aos.sistema.capturar(texto).then((ok) => {
      setEspera(!ok); // si Claude está ocupado, el texto queda para mandarlo después
      if (ok) setTexto("");
    });
  };
  return (
    <form className="cap" onSubmit={enviar}>
      <label className="sr" htmlFor="captura">Anotar algo rápido para Claude</label>
      <input id="captura" ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Anotar algo rápido…" autoComplete="off" />
      <kbd aria-hidden>⌥ Espacio</kbd>
      <p className={espera ? "espera" : "sr"} role="status">{espera ? "Claude está respondiendo otra cosa. Espera a que termine y vuelve a enviarlo." : ""}</p>
    </form>
  );
}

function Pie({ ahora }: { ahora: Date }) {
  const [sync, setSync] = useState<Estado>(() => window.aos.sync.estado());
  const [hasta, setHasta] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => window.aos.sync.onEstado(setSync), []);
  useEffect(() => void window.aos.config.leer().then((c) => setHasta(c.pausaHasta), () => {}), []);
  const pausar = (v: string | null) => {
    const antes = hasta;
    setHasta(v);
    setError(false);
    window.aos.config.guardar({ pausaHasta: v }).catch(() => { setHasta(antes); setError(true); });
  };
  const enPausa = hasta !== null && new Date(hasta) > ahora;
  const s = SYNC[sync];
  return (
    <footer className="foot">
      <span className={s.clase} role="status"><span aria-hidden>{s.icono} </span>{s.texto}</span>
      {error && <span className="tarde" role="alert">⚠ No pude guardar la pausa</span>}
      {enPausa
        ? <button className="link" onClick={() => pausar(null)}>Avisos en pausa hasta las {new Date(hasta).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} · Reanudar</button>
        : <button className="link" onClick={() => pausar(new Date(ahora.getTime() + PAUSA_MS).toISOString())}>Pausar avisos 1 h</button>}
    </footer>
  );
}

/** Sin persona elegida, la barra manda a elegirla en la ventana principal. */
export function BarraSinPersona() {
  const raiz = useAlto();
  return (
    <main ref={raiz} className="mb">
      <p className="vacio-mb">Elige quién eres en agencia-os para ver tu día aquí.</p>
      <button className="row" onClick={() => window.aos.sistema.principal()}><span className="txt">Abrir agencia-os</span><span className="r"><kbd>⌘ O</kbd></span></button>
    </main>
  );
}
