import { ArrowRightLeft, Calendar, Copy, Ellipsis, Sparkles, Tag, Trash2, UserRound } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ESTADOS } from "../datos/filtros";
import { titulo } from "../datos/hoy";
import { cambiar } from "../datos/md";
import { type Accion, fechaValida, teclaMenu } from "../datos/menu";
import { crearTarea } from "../datos/nueva";
import { useSesion } from "../datos/sesion";
import type { Entregable } from "../datos/tipos";
import { ElegirEtiquetas } from "./ElegirEtiquetas";
import { etiquetaEstado, useClicAfuera } from "./Filtros";
import { ICONO } from "./Lateral";

type Modo = "lista" | Accion;
type Props = {
  e: Entregable; onCambiar: (cambios: Partial<Entregable>) => void;
  onPedirClaude?: (texto: string) => void; onAbrir: (ruta: string) => void;
};

/** Botón ⋯ de la tarjeta y su menú. Las letras (M A R L ⌫) funcionan con el menú abierto o con la tarjeta enfocada. */
export function MenuTarea(props: Props) {
  const [menu, setMenu] = useState<{ modo: Modo; animar: boolean } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => { setMenu(null); boton.current?.focus(); }, []);
  useEffect(() => {
    const tarjeta = boton.current?.closest("article");
    if (!tarjeta) return;
    const tecla = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || (ev.target as HTMLElement).closest("input, textarea, select")) return;
      const modo = teclaMenu(ev.key);
      if (!modo) return;
      ev.preventDefault();
      setMenu({ modo, animar: false }); // por teclado: sin animación
    };
    tarjeta.addEventListener("keydown", tecla);
    return () => tarjeta.removeEventListener("keydown", tecla);
  }, []);
  return (
    <>
      <button
        ref={boton} className={menu ? "puntos on" : "puntos"} aria-label={`Más acciones para ${titulo(props.e.ruta)}`}
        aria-expanded={Boolean(menu)} aria-haspopup="dialog"
        onClick={(ev) => setMenu(menu ? null : { modo: "lista", animar: ev.detail !== 0 })}
      ><Ellipsis size={ICONO} aria-hidden /></button>
      {menu && (
        <Caja {...props} modo={menu.modo} animar={menu.animar} boton={boton} onCerrar={cerrar}
          onModo={(modo) => setMenu({ modo, animar: false })} />
      )}
    </>
  );
}

function Caja({ modo, animar, boton, onCerrar, onModo, ...props }: Props & {
  modo: Modo; animar: boolean; boton: RefObject<HTMLButtonElement | null>; onCerrar: () => void; onModo: (m: Modo) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useClicAfuera(caja, boton, onCerrar);
  // En la capa superior (popover) para que el overflow de las columnas no lo corte; `source` lo ancla al ⋯ (CSS anchor).
  // autoFocus no sirve: React enfoca antes de que el popover se vea. Se abre y se enfoca lo primero de cada vista.
  useLayoutEffect(() => {
    const c = caja.current as (HTMLElement & { showPopover(o?: { source?: HTMLElement | null }): void }) | null;
    if (!c) return;
    if (!c.matches(":popover-open")) c.showPopover({ source: boton.current });
    c.querySelector<HTMLElement>("input, button")?.focus();
  }, [boton, modo]);
  const hecho = (cambios: Partial<Entregable>) => { props.onCambiar(cambios); onCerrar(); };
  return (
    <div
      ref={caja} popover="manual" className={animar ? "menu anima" : "menu"} role="dialog" aria-label={`Acciones de ${titulo(props.e.ruta)}`}
      onKeyDown={(ev) => { if (ev.key === "Escape") { ev.preventDefault(); onCerrar(); } }}
    >
      {modo === "lista" && <Lista {...props} onModo={onModo} onCerrar={onCerrar} onError={setError} />}
      {modo !== "lista" && <Sub modo={modo} e={props.e} hecho={hecho} onCerrar={onCerrar} onError={setError}
        onCambiar={props.onCambiar} />}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Opcion({ icono, letra, peligro, onClick, children }: {
  icono: ReactNode; letra?: string; peligro?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" className={peligro ? "o peligro" : "o"} onClick={onClick}
      aria-keyshortcuts={letra === "⌫" ? "Backspace" : letra}>
      {icono}{children}{letra && <kbd className="der">{letra}</kbd>}
    </button>
  );
}

function Lista({ e, onPedirClaude, onAbrir, onModo, onCerrar, onError }: Props & {
  onModo: (m: Modo) => void; onCerrar: () => void; onError: (msg: string) => void;
}) {
  const { indice, persona } = useSesion();
  const t = titulo(e.ruta);
  const duplicar = async () => {
    try {
      const nueva = { titulo: `${t} (copia)`, cliente: e.cliente, responsable: e.responsable, vence: e.vence, estado: e.estado, etiquetas: e.etiquetas ?? [] };
      const ruta = await crearTarea(nueva, persona, new Set(indice.entregables.map((x) => x.ruta)));
      if (e.formato !== "tarea") await cambiar(ruta, { formato: e.formato }); // crearTarea siempre escribe "tarea"
      onCerrar();
      onAbrir(ruta);
    } catch {
      onError("No se pudo duplicar la tarea.");
    }
  };
  const i = { size: ICONO, "aria-hidden": true } as const;
  return (
    <>
      <Opcion icono={<ArrowRightLeft {...i} />} letra="M" onClick={() => onModo("mover")}>Mover a…</Opcion>
      <Opcion icono={<UserRound {...i} />} letra="A" onClick={() => onModo("asignar")}>Asignar</Opcion>
      <Opcion icono={<Calendar {...i} />} letra="R" onClick={() => onModo("reagendar")}>Reagendar</Opcion>
      <Opcion icono={<Tag {...i} />} letra="L" onClick={() => onModo("etiquetas")}>Etiquetas</Opcion>
      {onPedirClaude && (
        <Opcion icono={<Sparkles {...i} />} onClick={() => { onCerrar(); onPedirClaude(`Sobre la tarea “${t}” (${e.ruta}): `); }}>
          Pedirle a Claude
        </Opcion>
      )}
      <div className="sep" />
      <Opcion icono={<Copy {...i} />} onClick={() => void duplicar()}>Duplicar</Opcion>
      <Opcion peligro icono={<Trash2 {...i} />} letra="⌫" onClick={() => onModo("borrar")}>Borrar…</Opcion>
    </>
  );
}

function Sub({ modo, e, hecho, onCambiar, onCerrar, onError }: {
  modo: Accion; e: Entregable; hecho: (c: Partial<Entregable>) => void; onCambiar: (c: Partial<Entregable>) => void;
  onCerrar: () => void; onError: (msg: string) => void;
}) {
  const { indice } = useSesion();
  if (modo === "mover") {
    return (
      <>
        <div className="h">Mover a…</div>
        {ESTADOS.filter((x) => x !== e.estado).map((x) => (
          <button key={x} type="button" className="o" onClick={() => hecho({ estado: x })}>{etiquetaEstado(x)}</button>
        ))}
      </>
    );
  }
  if (modo === "asignar") {
    const gente = [...indice.personas.map((p) => ({ slug: p.slug, nombre: p.nombre })), { slug: "ia", nombre: "Claude" }];
    return (
      <>
        <div className="h">Asignar a</div>
        {gente.map((p) => (
          <button key={p.slug} type="button" className="o" aria-current={p.slug === e.responsable}
            onClick={() => hecho({ responsable: p.slug })}>
            {p.nombre}{p.slug === e.responsable && <span className="der">actual</span>}
          </button>
        ))}
      </>
    );
  }
  if (modo === "reagendar") {
    // Guarda en cada cambio válido sin cerrar (al teclear el día pasa por fechas intermedias); Enter cierra.
    // ponytail: un guardado por tecla, debounce si molesta en git.
    // Una fecha elegida por una persona deja de ser tentativa.
    const guardar = (v: string) => fechaValida(v) && onCambiar({ vence: v, fecha_tentativa: undefined });
    return (
      <label className="campo">
        Nueva fecha
        <input type="date" defaultValue={String(e.vence).slice(0, 10)} onChange={(ev) => guardar(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && onCerrar()} />
      </label>
    );
  }
  if (modo === "etiquetas") return <ElegirEtiquetas elegidas={e.etiquetas ?? []} onCambiar={(etiquetas) => onCambiar({ etiquetas })} />;
  const borrar = () => {
    // El ⋯ desaparece con la tarjeta: el foco queda en el "+" de su columna.
    const columna = document.querySelector(`[data-ruta="${CSS.escape(e.ruta)}"]`)?.closest(".col")?.querySelector<HTMLElement>(".mas-col");
    return window.aos.repo.delete(e.ruta).then(() => { onCerrar(); columna?.focus(); }, () => onError("No se pudo borrar."));
  };
  return (
    <div className="confirmar-menu" role="alertdialog" aria-label="Confirmar borrado">
      <span>¿Borrar esta tarea? Queda en el historial de git.</span>
      <button className="btn peligro" onClick={() => void borrar()}>Sí, borrar</button>
      <button className="btn plano" onClick={onCerrar}>Cancelar</button>
    </div>
  );
}
