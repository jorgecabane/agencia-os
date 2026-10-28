import { Calendar, Tag } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { colorPara, cuando, fechaLocal } from "../datos/hoy";
import { crearTarea, interpretar, type NuevaTarea as Tarea } from "../datos/nueva";
import { useSesion } from "../datos/sesion";
import { ElegirEtiquetas } from "./ElegirEtiquetas";
import { colorPersona } from "./Filtros";
import { ICONO } from "./Lateral";

type Campo = "cliente" | "responsable" | "vence" | "etiquetas";

/** Tarjeta en blanco arriba de una columna: título y Enter; cliente, responsable, fecha y etiquetas con sus botones. */
export function NuevaTarea({ inicial, onCreada, onCancelar }: {
  inicial: Partial<Tarea>; onCreada: (ruta: string) => void; onCancelar: () => void;
}) {
  const { indice, persona } = useSesion();
  const [t, setT] = useState<Tarea>(() => ({
    titulo: "", responsable: persona, vence: fechaLocal(), estado: "brief", etiquetas: [],
    cliente: indice.clientes.length === 1 ? indice.clientes[0].slug : "", ...inicial,
  }));
  const [abierto, setAbierto] = useState<Campo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const titulo = useRef<HTMLInputElement>(null);
  const id = useId();
  const volver = () => { setAbierto(null); titulo.current?.focus(); };
  /** Etiquetas se eligen varias: no cierran la lista. */
  const fijar = (c: Partial<Tarea>, cerrar = true) => { setT({ ...t, ...c }); setError(null); if (cerrar) volver(); };

  const crear = async () => {
    const leido = interpretar(t.titulo, indice);
    const lista = { ...t, titulo: leido.titulo, cliente: leido.cliente ?? t.cliente, responsable: leido.responsable ?? t.responsable };
    if (!lista.titulo || creando) return;
    if (!lista.cliente) { setError("Elige un cliente"); setAbierto("cliente"); return; }
    setCreando(true);
    try {
      onCreada(await crearTarea(lista, persona, new Set(indice.entregables.map((e) => e.ruta))));
    } catch {
      setError("No se pudo crear la tarea. Revisa la conexión con el repo.");
      setCreando(false);
    }
  };
  const tecla = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (abierto) volver();
      else onCancelar();
    } else if (ev.key === "Enter" && ev.target === titulo.current) {
      ev.preventDefault();
      void crear();
    }
  };
  return (
    <div className="nueva" onKeyDown={tecla}>
      <input ref={titulo} autoFocus aria-label="Título de la tarea" placeholder="Título de la tarea" value={t.titulo}
        onChange={(ev) => setT({ ...t, titulo: ev.target.value })}
        aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined} />
      <Opciones t={t} abierto={abierto} setAbierto={setAbierto} />
      {error && <p id={id} className="error" role="alert">{error}</p>}
      {abierto && <Elegir campo={abierto} t={t} fijar={fijar} />}
      <div className="ayuda"><span>Enter para crear · Esc para cancelar</span><span>@ persona · # cliente</span></div>
    </div>
  );
}

function Opciones({ t, abierto, setAbierto }: { t: Tarea; abierto: Campo | null; setAbierto: (c: Campo | null) => void }) {
  const { indice } = useSesion();
  const cliente = indice.clientes.find((c) => c.slug === t.cliente)?.nombre ?? t.cliente;
  const persona = t.responsable === "ia" ? "Claude" : indice.personas.find((p) => p.slug === t.responsable)?.nombre ?? t.responsable;
  const fecha = cuando(t.vence, fechaLocal()).texto;
  const chip = (c: Campo, etiqueta: string, cuerpo: ReactNode) => (
    <button type="button" className="chip-m" aria-label={etiqueta} aria-expanded={abierto === c} onClick={() => setAbierto(abierto === c ? null : c)}>
      {cuerpo}
    </button>
  );
  return (
    <div className="opc">
      {chip("cliente", `Cliente: ${cliente || "sin elegir"}`, cliente
        ? <><span className="dot" style={{ background: colorPara(t.cliente) }} aria-hidden />{cliente}</>
        : "Cliente")}
      {chip("responsable", `Responsable: ${persona}`, <>
        <span className="av" style={{ background: colorPersona(t.responsable) }} aria-hidden>{t.responsable === "ia" ? "✦" : persona[0]}</span>
        {persona}
      </>)}
      {chip("vence", `Vence: ${fecha}`, <><Calendar size={ICONO} aria-hidden />{fecha[0].toUpperCase() + fecha.slice(1)}</>)}
      {chip("etiquetas", `Etiquetas: ${t.etiquetas.length || "ninguna"}`, <>
        <Tag size={ICONO} aria-hidden />{t.etiquetas.length ? `${t.etiquetas.length} etiqueta${t.etiquetas.length === 1 ? "" : "s"}` : "Etiqueta"}
      </>)}
    </div>
  );
}

function Elegir({ campo, t, fijar }: { campo: Campo; t: Tarea; fijar: (c: Partial<Tarea>, cerrar?: boolean) => void }) {
  const { indice } = useSesion();
  if (campo === "vence") {
    return (
      <label className="campo">
        Vence
        <input type="date" autoFocus defaultValue={t.vence} onKeyDown={(ev) => ev.key === "Enter" && fijar({ vence: ev.currentTarget.value || t.vence })}
          onBlur={(ev) => ev.currentTarget.value && fijar({ vence: ev.currentTarget.value })} />
      </label>
    );
  }
  if (campo === "etiquetas") return <ElegirEtiquetas elegidas={t.etiquetas} onCambiar={(etiquetas) => fijar({ etiquetas }, false)} />;
  const valores = campo === "cliente"
    ? indice.clientes.map((c) => ({ slug: c.slug, nombre: c.nombre }))
    : [...indice.personas.map((p) => ({ slug: p.slug, nombre: p.nombre })), { slug: "ia", nombre: "Claude" }];
  return (
    <div className="lista-nueva" role="group" aria-label={campo === "cliente" ? "Elegir cliente" : "Elegir responsable"}>
      {valores.map((v, k) => (
        <button key={v.slug} type="button" className="o" autoFocus={k === 0} aria-pressed={t[campo] === v.slug} onClick={() => fijar({ [campo]: v.slug })}>
          {v.nombre}
        </button>
      ))}
    </div>
  );
}
