import { ArrowRight, CalendarDays, FileText, Plus, Search, Sparkles, SquareKanban } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { colorPara } from "../datos/hoy";
import type { NuevaTarea as Tarea } from "../datos/nueva";
import { buscar, type Accion, type Opcion } from "../datos/paleta";
import { useSesion } from "../datos/sesion";
import { ICONO } from "./Lateral";
import { NuevaTarea } from "./NuevaTarea";
import "./paleta.css";

// A dónde vuelve el foco al cerrar cada diálogo.
const volverA = new WeakMap<Element, HTMLElement | null>();

/**
 * `<dialog>` modal mientras está montado; al cerrarse, el foco vuelve a donde estaba. Si eso estaba en otro diálogo
 * que ya se cerró (⌘K → "Nueva tarea"), sigue la cadena hasta algo que siga en pantalla.
 */
function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const [antes] = useState(() => document.activeElement as HTMLElement | null); // antes del autoFocus
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    volverA.set(d, antes);
    if (!d.open) d.showModal(); // StrictMode corre el efecto dos veces
    return () => {
      let t = antes;
      while (t && !t.isConnected) t = volverA.get(t.closest("dialog") as Element) ?? null;
      t?.focus();
    };
  }, []);
  return ref;
}

function Icono({ o: { grupo, accion: a } }: { o: Opcion }) {
  if (a.tipo === "ir" && a.pantalla.nombre === "cliente") return <span className="dot" style={{ background: colorPara(a.pantalla.slug) }} aria-hidden />;
  const I = a.tipo === "nueva" ? Plus : a.tipo === "claude" ? Sparkles : a.tipo === "ir" ? ArrowRight
    : grupo === "Tareas" ? SquareKanban : grupo === "Reuniones" ? CalendarDays : FileText;
  return <I size={ICONO} aria-hidden />;
}

/** ⌘K: buscar, ir y crear. Sin animación al abrir: se usa decenas de veces al día. */
export function Paleta({ fecha, onAccion, onCerrar }: { fecha: string; onAccion: (a: Accion) => void; onCerrar: () => void }) {
  const { indice, persona } = useSesion();
  const [q, setQ] = useState("");
  const [k, setK] = useState(0);
  const opciones = useMemo(() => buscar(q, indice, fecha, persona), [q, indice, fecha, persona]);
  const caja = useModal();
  const id = useId();
  const activa = `${id}-${k}`;
  useEffect(() => { document.getElementById(activa)?.scrollIntoView({ block: "nearest" }); }, [activa]); // en Chromium devuelve una promesa: no es limpieza

  const tecla = (e: KeyboardEvent) => {
    const paso = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (paso) setK((k + paso + opciones.length) % opciones.length);
    else if (e.key === "Enter" && !e.nativeEvent.isComposing && opciones[k]) onAccion(opciones[k].accion);
    else if (e.key === "Escape") onCerrar();
    else return;
    e.preventDefault();
  };
  const grupos = [...new Set(opciones.map((o) => o.grupo))];
  return (
    <dialog ref={caja} className="paleta" aria-label="Buscar o crear" onCancel={(e) => { e.preventDefault(); onCerrar(); }}>
      <div className="in">
        <Search size={ICONO} aria-hidden />
        <input autoFocus role="combobox" aria-label="Buscar o crear" aria-expanded aria-controls={`${id}-l`} aria-activedescendant={activa}
          aria-autocomplete="list" value={q} onChange={(e) => { setQ(e.target.value); setK(0); }} onKeyDown={tecla} />
      </div>
      <div className="lista-p" role="listbox" id={`${id}-l`} aria-label="Resultados">
        {grupos.map((g) => (
          <div key={g} role="group" aria-labelledby={`${id}-${g}`}>
            <div className="grupo-p" id={`${id}-${g}`}>{g}</div>
            {opciones.map((o, n) => o.grupo === g && (
              <div key={o.id} id={`${id}-${n}`} role="option" aria-selected={n === k} className={n === k ? "op-p hl" : "op-p"}
                onMouseMove={() => setK(n)} onClick={() => onAccion(o.accion)}>
                <Icono o={o} />{o.titulo}{o.detalle && <span className="der">{o.detalle}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="pie-p" aria-hidden><span>↑↓ moverse</span><span>Enter abrir</span><span>Esc cerrar</span></div>
    </dialog>
  );
}

/**
 * ⌘N: la tarjeta de tarea nueva en un diálogo. Con el foco en la tarjeta, Escape lo maneja ella; si el foco quedó
 * fuera (en el diálogo), Escape cierra primero la lista abierta y si no hay, el diálogo.
 */
export function DialogoNueva({ inicial, onCreada, onCerrar }: { inicial: Partial<Tarea>; onCreada: (ruta: string) => void; onCerrar: () => void }) {
  const caja = useModal();
  return (
    <dialog ref={caja} className="paleta nueva-d" aria-label="Nueva tarea" onClose={onCerrar} onCancel={(e) => {
      e.preventDefault();
      const lista = caja.current?.querySelector<HTMLElement>('.chip-m[aria-expanded="true"]');
      if (lista) lista.click();
      else onCerrar();
    }}>
      <NuevaTarea inicial={inicial} onCreada={onCreada} onCancelar={onCerrar} />
    </dialog>
  );
}
