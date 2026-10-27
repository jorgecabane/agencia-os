import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Commit } from "../../shared/puente";
import { Panel } from "../componentes/Panel";
import { clienteDeRuta, colorPara, cuando, hoy, titulo } from "../datos/hoy";
import { separar } from "../datos/md";
import { novedades } from "../datos/novedades";
import { promesasDeActa } from "../datos/promesas";
import { propuestas } from "../datos/propuestas";
import { useSesion } from "../datos/sesion";
import type { Entregable, Promesa } from "../datos/tipos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Visita = { commits: Commit[]; yo: string };

// Una vez por sesión de la app: volver a Hoy (p. ej. desde Editar) muestra las mismas novedades.
let visita: Promise<Visita> | null = null;
async function cargarVisita(): Promise<Visita> {
  const [{ ultimoVisto }, { email }, [head]] = await Promise.all([
    window.aos.config.leer(), window.aos.git.yo(), window.aos.git.log({ max: 1 }),
  ]);
  if (!head) return { commits: [], yo: email };
  // Sin visita previa no hay "desde": solo se marca. Si el commit ya no existe (rebase), se omite.
  const commits = ultimoVisto && ultimoVisto !== head.hash
    ? await window.aos.git.log({ desde: ultimoVisto }).catch(() => [])
    : [];
  await window.aos.config.guardar({ ultimoVisto: head.hash });
  return { commits, yo: email };
}

/** Commits desde la última visita; al leerlos se marca HEAD como visto. */
function useDesdeUltimaVisita(): Visita {
  const [r, setR] = useState<Visita>({ commits: [], yo: "" });
  useEffect(() => {
    let vivo = true;
    visita ??= cargarVisita().catch(() => ({ commits: [], yo: "" }));
    void visita.then((v) => vivo && setR(v));
    return () => { vivo = false; };
  }, []);
  return r;
}

/** Lee los cuerpos que Hoy necesita: propuesta recomendada por entregable y promesas abiertas de las actas. */
function useCuerpos(entregables: Entregable[], actas: string[]) {
  const { indice } = useSesion();
  const [recomendada, setRecomendada] = useState<Record<string, string>>({});
  const [promesas, setPromesas] = useState<Promesa[]>([]);
  const clave = entregables.map((e) => e.ruta).join("|");
  const claveActas = actas.join("|");
  useEffect(() => {
    let vivo = true;
    const leer = (r: string) => window.aos.repo.read(r).then((t) => separar(t).cuerpo, () => "");
    const slugs = new Set(indice.personas.map((p) => p.slug));
    void Promise.all([
      Promise.all(entregables.map(async (e) => {
        const ps = propuestas(await leer(e.ruta));
        return [e.ruta, (ps.find((p) => p.recomendada) ?? ps[0])?.texto] as const;
      })),
      Promise.all(indice.reuniones.filter((r) => actas.includes(r.ruta)).map(async (r) =>
        promesasDeActa(r, await leer(r.ruta), slugs).promesas)),
    ]).then(([recs, ps]) => {
      if (!vivo) return;
      setRecomendada(Object.fromEntries(recs.filter((x): x is [string, string] => Boolean(x[1]))));
      setPromesas(ps.flat());
    });
    return () => { vivo = false; };
    // Se relee cuando cambia el índice (alguien tocó un archivo) o la lista de rutas.
  }, [indice, clave, claveActas]);
  return { recomendada, promesas };
}

export function Hoy({ fecha, onEditar }: { fecha: string; onEditar: (ruta: string) => void }) {
  const { indice, persona } = useSesion();
  const [sel, setSel] = useState<{ ruta: string; animar: boolean } | null>(null);
  const misClientes = new Set(indice.clientes.filter((c) => c.responsable === persona).map((c) => c.slug));
  const actas = indice.reuniones.filter((r) => r.tipo === "reunion" && misClientes.has(r.cliente)).map((r) => r.ruta);
  const base = hoy(indice, persona, fecha);
  const { recomendada, promesas } = useCuerpos([...base.entregas, ...base.tentativas], actas);
  const h = hoy(indice, persona, fecha, promesas);
  const { commits, yo } = useDesdeUltimaVisita();
  const frases = novedades(commits, yo, indice.personas);
  const nombre = indice.personas.find((p) => p.slug === persona)?.nombre ?? persona;
  const origen = useRef<HTMLElement | null>(null);
  const cerrar = useCallback(() => {
    setSel(null);
    origen.current?.focus(); // si la fila ya no existe (borrada), el foco queda en el documento
  }, []);
  const nombreCliente = (slug: string) => indice.clientes.find((c) => c.slug === slug)?.nombre ?? slug;

  // Un clic de teclado (detail 0) abre el panel sin animación.
  const abrir = (ruta: string) => (e: MouseEvent<HTMLElement>) => {
    origen.current = e.currentTarget;
    setSel(sel?.ruta === ruta ? null : { ruta, animar: e.detail !== 0 });
  };
  const fila = (ruta: string, cuandoTxt: ReactNode, tarde: boolean, cliente: string, t: string, sub: ReactNode, estado?: ReactNode) => (
    <button key={ruta + t} className="fila" aria-pressed={sel?.ruta === ruta} onClick={abrir(ruta)}>
      <span className={tarde ? "cuando tarde" : "cuando"}>{cuandoTxt}</span>
      <span className="barra" style={{ background: colorPara(cliente) }} aria-hidden />
      <span><span className="t">{t}</span><span className="sub">{sub}</span></span>
      {estado}
    </button>
  );
  const subEntrega = (e: Entregable) =>
    recomendada[e.ruta] ? <><span className="ic" aria-hidden>✦ </span>{recomendada[e.ruta]}</> : `${e.formato} · sin propuesta todavía`;
  const atraso = (tarde: boolean) => tarde && <span className="chip tarde"><span aria-hidden>▲</span>atrasado</span>;

  const dia = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric" });
  const resumen = [plural(h.entregas.length, "entrega", "entregas"), plural(h.reuniones.length, "reunión", "reuniones")];
  if (h.debeCliente.length) resumen.push(plural(h.debeCliente.length, "cosa que nos debe el cliente", "cosas que nos debe el cliente"));
  const nada = !h.entregas.length && !h.reuniones.length && !h.tentativas.length && !h.debeCliente.length;

  return (
    <>
      <main className="principal">
        <div className="hoy">
          <h1 className="titulo">{dia[0].toUpperCase() + dia.slice(1)}</h1>
          <p className="bajada">Hola, {nombre}. Hoy tienes {resumen.slice(0, -1).join(", ")} y {resumen.at(-1)}.</p>
          {frases.length > 0 && <p className="novedades"><b>Desde tu última visita:</b> {frases.join(". ")}.</p>}
          {nada && <p className="vacio">Nada vence hoy. Buen momento para adelantar lo de la semana o pedirle ideas a Claude.</p>}

          <Seccion titulo="Reuniones" n={h.reuniones.length}>
            {h.reuniones.map((r) => fila(r.ruta, String(r.fecha).slice(11, 16) || "hoy", false, r.cliente,
              `${titulo(r.ruta)} · ${nombreCliente(r.cliente)}`, r.tipo === "brief-reunion" ? "Brief listo" : "Acta",
              r.tipo === "brief-reunion" && <span className="chip ok"><span aria-hidden>✓</span>brief listo</span>))}
          </Seccion>
          <Seccion titulo="Entregas" n={h.entregas.length}>
            {h.entregas.map((e) => {
              const c = cuando(e.vence, fecha);
              return fila(e.ruta, c.texto, c.tarde, e.cliente, `${titulo(e.ruta)} · ${nombreCliente(e.cliente)}`, subEntrega(e), atraso(c.tarde));
            })}
          </Seccion>
          <Seccion titulo="Fechas por confirmar" n={h.tentativas.length}>
            {h.tentativas.map((e) => fila(e.ruta, cuando(e.vence, fecha).texto, false, e.cliente,
              `${titulo(e.ruta)} · ${nombreCliente(e.cliente)}`, "Fecha tentativa: confírmala o reagéndala",
              <span className="chip"><span aria-hidden>?</span>confirmar</span>))}
          </Seccion>
          <Seccion titulo="Lo que nos debe el cliente" n={h.debeCliente.length}>
            {h.debeCliente.map((p) => {
              const c = p.fecha ? cuando(p.fecha, fecha) : { texto: "sin fecha", tarde: false };
              const cl = clienteDeRuta(p.acta) ?? "";
              return fila(p.acta, c.texto, c.tarde, cl, `${p.que[0].toUpperCase()}${p.que.slice(1)} · ${nombreCliente(cl)}`, `Lo prometió ${p.quien}`, atraso(c.tarde));
            })}
          </Seccion>
        </div>
      </main>
      {sel && <Panel key={sel.ruta} ruta={sel.ruta} animar={sel.animar} onCerrar={cerrar} onEditar={onEditar} />}
    </>
  );
}

function Seccion({ titulo, n, children }: { titulo: string; n: number; children: ReactNode }) {
  if (!n) return null;
  return (
    <section className="seccion" aria-label={titulo}>
      <h2>{titulo} <span className="c">{n}</span></h2>
      {children}
    </section>
  );
}
