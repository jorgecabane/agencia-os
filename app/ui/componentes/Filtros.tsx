import { type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { aplicar, alternar, CAMPO, conteos, ESTADOS, type Filtro, type Lista, type Vence } from "../datos/filtros";
import { colorEtiqueta } from "../datos/etiquetas";
import { colorPara } from "../datos/hoy";
import { useSesion } from "../datos/sesion";
import type { Entregable } from "../datos/tipos";
import { ESTADO } from "./Panel";

type Categoria = Lista | "etiquetas" | "vence";
const CATEGORIAS: { k: Categoria; nombre: string }[] = [
  { k: "personas", nombre: "Persona" }, { k: "clientes", nombre: "Cliente" }, { k: "formatos", nombre: "Formato" },
  { k: "vence", nombre: "Vence" }, { k: "estados", nombre: "Estado" }, { k: "etiquetas", nombre: "Etiquetas" },
];
const VENCE: Record<Exclude<Vence, "todo">, string> = { hoy: "hoy", semana: "esta semana", atrasado: "atrasado" };

type Opcion = { id: string; etiqueta: string; k?: string; color?: string; n?: number; marcado?: boolean; ir?: boolean; hacer: () => void };

export const colorPersona = (slug: string) => (slug === "ia" ? "var(--ia)" : colorPara(slug));
export const etiquetaEstado = (e: string) => { const t = ESTADO[e] ?? e; return t[0].toUpperCase() + t.slice(1); };

/** Nombres legibles de cada valor por campo, en el orden en que se muestran. */
function useNombres(es: Entregable[]) {
  const { indice } = useSesion();
  const con = (conocidos: [string, string][], k: keyof Entregable) => {
    const m = new Map(conocidos);
    for (const e of es) if (!m.has(String(e[k]))) m.set(String(e[k]), String(e[k]));
    return m;
  };
  const etiquetas = new Map(indice.etiquetas.map((t) => [t.slug, t.nombre]));
  for (const t of es.flatMap((e) => e.etiquetas ?? [])) if (!etiquetas.has(t)) etiquetas.set(t, t); // fuera del catálogo
  return {
    personas: con([...indice.personas.map((p): [string, string] => [p.slug, p.nombre]), ["ia", "Claude"]], "responsable"),
    clientes: con(indice.clientes.map((c) => [c.slug, c.nombre]), "cliente"),
    formatos: con([], "formato"),
    estados: new Map<string, string>(ESTADOS.map((e) => [e, etiquetaEstado(e)])),
    etiquetas,
    colorEtiqueta: new Map(indice.etiquetas.map((t) => [t.slug, colorEtiqueta(t)])),
  };
}

/** Caras del equipo, menú "Filtrar" (tecla F) con buscador y conteos, y chips con ×. `children` va a la derecha. */
/** La tecla F (fuera de campos de texto y sin modificadores) llama a `abrir`. */
function useTeclaF(abrir: () => void) {
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      const escribiendo = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable], dialog");
      if (e.key.toLowerCase() !== "f" || e.metaKey || e.ctrlKey || e.altKey || escribiendo) return;
      e.preventDefault();
      abrir();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abrir]);
}

export function Filtros({ es, filtro, cambiar, fecha, children }: {
  es: Entregable[]; filtro: Filtro; cambiar: (f: Filtro) => void; fecha: string; children?: ReactNode;
}) {
  const nombres = useNombres(es);
  const [menu, setMenu] = useState<{ animar: boolean } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = () => { setMenu(null); boton.current?.focus(); };
  useTeclaF(useCallback(() => setMenu({ animar: false }), [])); // por teclado: sin animación
  const personas = filtro.personas ?? [];

  return (
    <div className="barra-filtros">
      <div className="caras" role="group" aria-label="Filtrar por persona">
        {[...nombres.personas].map(([slug, nombre]) => {
          const on = personas.includes(slug);
          return (
            <button
              key={slug} className={`av${on ? " on" : personas.length ? " off" : ""}`} style={{ background: colorPersona(slug) }}
              title={nombre} aria-label={nombre} aria-pressed={on} onClick={() => cambiar(alternar(filtro, "personas", slug))}
            >{slug === "ia" ? "✦" : nombre[0]}</button>
          );
        })}
      </div>
      <span className="sep" aria-hidden />
      <span className="ancla">
        <button
          ref={boton} className={menu ? "btn plano abierto" : "btn plano"} aria-expanded={Boolean(menu)} aria-haspopup="dialog"
          onClick={(e: MouseEvent) => (menu ? setMenu(null) : setMenu({ animar: e.detail !== 0 }))}
        >Filtrar <kbd className="kbd">F</kbd></button>
        {menu && <Menu {...{ es, filtro, cambiar, fecha, nombres }} animar={menu.animar} onCerrar={cerrar} boton={boton} />}
      </span>
      <Chips filtro={filtro} cambiar={cambiar} nombres={nombres} />
      <div className="derecha">{children}</div>
    </div>
  );
}

/** Un chip por filtro activo (salvo personas, que se ven en las caras), cada uno con ×. */
function Chips({ filtro, cambiar, nombres }: Pick<Contexto, "filtro" | "cambiar" | "nombres">) {
  const chip = (clave: keyof Filtro, k: string, valor: ReactNode) => (
    <span className="chip filtro" key={clave}>
      {k && <span className="k">{k}</span>}{valor}
      <button
        className="x" onClick={() => cambiar({ ...filtro, [clave]: undefined })}
        aria-label={`Quitar filtro ${k ? `de ${k.toLowerCase()}` : valor}`}
      >×</button>
    </span>
  );
  const listas = (["clientes", "formatos", "estados", "etiquetas"] as const).filter((k) => filtro[k]?.length);
  return (
    <>
      {listas.map((k) => chip(k, CATEGORIAS.find((c) => c.k === k)!.nombre, filtro[k]!.map((v) => (
        <span key={v} className="valor">
          {k === "clientes" && <span className="dot" style={{ background: colorPara(v) }} aria-hidden />}
          {k === "etiquetas" && <span className="dot" style={{ background: nombres.colorEtiqueta.get(v) ?? "var(--tenue)" }} aria-hidden />}
          {nombres[k].get(v) ?? v}
        </span>
      ))))}
      {filtro.vence && filtro.vence !== "todo" && chip("vence", "Vence", VENCE[filtro.vence])}
      {filtro.esperandoCliente && chip("esperandoCliente", "", "Esperando al cliente")}
    </>
  );
}

type Contexto = { es: Entregable[]; filtro: Filtro; cambiar: (f: Filtro) => void; fecha: string; nombres: ReturnType<typeof useNombres> };

function conteoEtiquetas(es: Entregable[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const t of es.flatMap((e) => e.etiquetas ?? [])) n[t] = (n[t] ?? 0) + 1;
  return n;
}

/** Opciones de una categoría, con su conteo según los demás filtros. */
function valoresDe(k: Categoria, { es, filtro, cambiar, fecha, nombres }: Contexto): Opcion[] {
  const nombreCat = CATEGORIAS.find((c) => c.k === k)!.nombre;
  if (k === "vence") {
    return (Object.keys(VENCE) as (keyof typeof VENCE)[]).map((v) => ({
      id: `vence-${v}`, k: nombreCat, etiqueta: VENCE[v][0].toUpperCase() + VENCE[v].slice(1), marcado: filtro.vence === v,
      n: aplicar(es, { ...filtro, vence: v }, fecha).length,
      hacer: () => cambiar({ ...filtro, vence: filtro.vence === v ? undefined : v }),
    }));
  }
  const otros = aplicar(es, { ...filtro, [k]: undefined }, fecha);
  const n = k === "etiquetas" ? conteoEtiquetas(otros) : conteos(otros, CAMPO[k]);
  return [...nombres[k]].map(([v, etiqueta]) => ({
    id: `${k}-${v}`, k: nombreCat, etiqueta, n: n[v] ?? 0, marcado: filtro[k]?.includes(v),
    color: k === "clientes" ? colorPara(v) : k === "personas" ? colorPersona(v) : k === "etiquetas" ? nombres.colorEtiqueta.get(v) : undefined,
    hacer: () => cambiar(alternar(filtro, k, v)),
  }));
}

/** Un clic fuera del menú (y fuera de su botón) lo cierra. */
export function useClicAfuera(caja: RefObject<HTMLElement | null>, boton: RefObject<HTMLElement | null>, onCerrar: () => void) {
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!caja.current?.contains(t) && !boton.current?.contains(t)) onCerrar();
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [caja, boton, onCerrar]);
}

function Menu({ animar, onCerrar, boton, ...ctx }: Contexto & {
  animar: boolean; onCerrar: () => void; boton: RefObject<HTMLButtonElement | null>;
}) {
  const [cat, setCat] = useState<Categoria | null>(null);
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  useClicAfuera(caja, boton, onCerrar);

  const entrar = (k: Categoria | null) => { setCat(k); setQ(""); setHl(0); };
  const busca = q.trim().toLowerCase();
  const calza = (o: Opcion) => o.etiqueta.toLowerCase().includes(busca);
  const opciones: Opcion[] = cat
    ? valoresDe(cat, ctx).filter(calza)
    : busca
      ? CATEGORIAS.flatMap((c) => valoresDe(c.k, ctx)).filter(calza)
      : CATEGORIAS.map((c) => ({ id: `cat-${c.k}`, etiqueta: c.nombre, ir: true, hacer: () => entrar(c.k) }));
  const marcada = Math.min(hl, Math.max(0, opciones.length - 1));
  const cual = CATEGORIAS.find((c) => c.k === cat)?.nombre.toLowerCase();

  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    const paso = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (paso) { e.preventDefault(); setHl((marcada + paso + opciones.length) % Math.max(1, opciones.length)); }
    else if (e.key === "Enter") { e.preventDefault(); opciones[marcada]?.hacer(); }
    else if (e.key === "Escape") { e.preventDefault(); onCerrar(); }
    else if (e.key === "Backspace" && !q && cat) entrar(null);
  };

  return (
    <div ref={caja} className={animar ? "pop anima" : "pop"} role="dialog" aria-label={cual ? `Filtrar por ${cual}` : "Filtrar"}>
      <input
        autoFocus value={q} onChange={(e) => { setQ(e.target.value); setHl(0); }} onKeyDown={tecla}
        placeholder={cual ? `Buscar ${cual}…` : "Filtrar por…"} aria-label={cual ? `Buscar ${cual}` : "Buscar filtro"}
        role="combobox" aria-expanded aria-controls="filtro-opciones"
        aria-activedescendant={opciones[marcada] ? `op-${opciones[marcada].id}` : undefined}
      />
      {cat && <button className="cabeza" onClick={() => entrar(null)}>‹ {CATEGORIAS.find((c) => c.k === cat)?.nombre}</button>}
      <div id="filtro-opciones" role="listbox" aria-multiselectable={Boolean(cat || busca)} aria-label="Opciones">
        {opciones.map((o, i) => (
          <FilaOpcion key={o.id} o={o} marcada={i === marcada} conCategoria={!cat && Boolean(busca)} onEncima={() => setHl(i)} />
        ))}
        {!opciones.length && <div className="op vacia">Nada calza con “{q}”</div>}
      </div>
    </div>
  );
}

function FilaOpcion({ o, marcada, conCategoria, onEncima }: { o: Opcion; marcada: boolean; conCategoria: boolean; onEncima: () => void }) {
  return (
    <div
      id={`op-${o.id}`} role="option" aria-selected={o.ir ? undefined : Boolean(o.marcado)}
      className={marcada ? "op hl" : "op"} onMouseMove={onEncima} onClick={o.hacer}
    >
      {!o.ir && <span className={o.marcado ? "caja on" : "caja"} aria-hidden>{o.marcado && "✓"}</span>}
      {o.color && <span className="dot" style={{ background: o.color }} aria-hidden />}
      {conCategoria && <span className="k">{o.k}</span>}
      {o.etiqueta}
      <span className="n">{o.ir ? "›" : o.n}</span>
    </div>
  );
}
