import { useEffect, useRef, useState } from "react";
import type { Commit } from "../../shared/puente";
import { autor, hace } from "../datos/actividad";
import { fechaLocal, titulo } from "../datos/hoy";
import { componer, modoInicial, relativa, rutaAdjunto, type Modo } from "../datos/markdown";
import { separar } from "../datos/md";
import { aGuardar, pendiente } from "../datos/mezcla";
import { useSesion } from "../datos/sesion";
import { Etiquetas } from "./Etiquetas";
import { Lienzo, MAX_IMAGEN, type Enlace } from "./Lienzo";

const ESPERA_GUARDADO_MS = 1000;

type Estado = "guardado" | "pendiente" | "guardando";
type Props = {
  ruta: string;
  onPedirClaude?: (pedido: string) => void;
  /** Un guardado que falla después de salir del editor (al volver) no tiene dónde mostrarse: se avisa arriba. */
  onErrorFuera?: (mensaje: string) => void;
  /** Muestra "Historial" junto a "Editado por…". */
  onHistorial?: () => void;
};

/** Texto que se edita en cada modo: el cuerpo, o el archivo entero si su frontmatter está roto. */
const textoDe = (archivo: string, modo: Modo) => (modo === "archivo" ? archivo : separar(archivo).cuerpo);

/** Página tipo Notion: frontmatter como etiquetas arriba, cuerpo en Milkdown Crepe (o markdown), guardado solo y mezcla segura. */
export function Editor({ ruta, onPedirClaude, onErrorFuera, onHistorial }: Props) {
  const { indice } = useSesion();
  const [base, setBase] = useState<string | null>(null); // lo último leído o escrito: con esto se compara
  const [modo, setModo] = useState<Modo>("visual");
  const [version, setVersion] = useState(0); // sube para recargar el lienzo con `base`
  const [estado, setEstado] = useState<Estado>("guardado");
  const [conflicto, setConflicto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<Commit>();
  const [cambiosVista, setCambiosVista] = useState<Record<string, unknown>>({});
  // visto = contenido del lienzo ya incorporado a `base`; leer = lectura en vivo del lienzo (null si no existe).
  const r = useRef({
    base: "", modo: "visual" as Modo, visto: null as string | null, leer: null as (() => string) | null,
    cambios: {} as Record<string, unknown>, timer: 0, guardando: false, montado: true,
  });
  const actual = () => r.current.leer?.() ?? null;
  const sucio = () => pendiente(r.current.visto, actual(), r.current.cambios);

  const cargar = (texto: string, modoPedido?: Modo) => {
    const s = r.current;
    const necesario = modoInicial(texto);
    // El modo que el archivo exige manda; si no exige nada, se respeta lo que eligió la persona.
    s.modo = necesario !== "visual" ? necesario : modoPedido ?? (s.modo === "archivo" ? "visual" : s.modo);
    Object.assign(s, { base: texto, cambios: {}, leer: null, visto: null });
    setCambiosVista({});
    setBase(texto);
    setModo(s.modo);
    setVersion((v) => v + 1);
  };

  const guardar = async (): Promise<void> => {
    const s = r.current;
    clearTimeout(s.timer);
    if (s.guardando) return void (s.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS));
    if (!sucio()) return void (s.montado && setEstado("guardado")); // un aviso de cambio sin cambio real
    s.guardando = true;
    if (s.montado) setEstado("guardando");
    try {
      const { cambios, modo: m } = s;
      const texto = actual() ?? textoDe(s.base, m);
      const mio = componer(s.base, cambios, texto, m);
      const enDisco = await window.aos.repo.read(ruta).catch(() => s.base);
      const res = aGuardar(s.base, mio, enDisco);
      if (res.texto !== null) await window.aos.repo.write(ruta, res.texto);
      const escrito = res.texto ?? enDisco;
      const siguio = (actual() ?? texto) !== texto || s.cambios !== cambios;
      // Si siguió escribiendo mientras se guardaba, su lienzo parte de `mio`: esa es la base del próximo guardado.
      s.base = siguio ? mio : escrito;
      s.visto = texto;
      if (s.cambios === cambios) s.cambios = {};
      if (!s.montado) return;
      setCambiosVista(s.cambios);
      setBase(s.base);
      if (res.conflicto) setConflicto(true);
      // Entró algo de afuera: el lienzo muestra la mezcla, salvo que siga escribiendo (se mezcla en el próximo guardado).
      if (escrito !== mio && !siguio) cargar(escrito, m);
      setEstado(sucio() ? "pendiente" : "guardado");
      if (sucio()) s.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS);
    } catch (e) {
      const msg = `No pude guardar ${titulo(ruta)}: ${e instanceof Error ? e.message : String(e)}`;
      if (!s.montado) return onErrorFuera?.(msg);
      setEstado("pendiente");
      setAviso(msg);
    } finally {
      s.guardando = false;
    }
  };
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  const programar = () => {
    setEstado("pendiente");
    clearTimeout(r.current.timer);
    r.current.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS);
  };

  useEffect(() => {
    r.current.montado = true;
    let vivo = true;
    const traerUltimo = () => void window.aos.git.log({ ruta, max: 1 }).then(([c]) => vivo && setUltimo(c), () => {});
    void window.aos.repo.read(ruta).then((t) => vivo && cargar(t), (e: unknown) => vivo && setAviso(`No pude abrir el archivo: ${String(e)}`));
    traerUltimo();
    const quitar = window.aos.repo.onCambio((rutas) => {
      if (!rutas.includes(ruta)) return;
      traerUltimo();
      // Con cambios sin guardar (leídos en vivo) no se recarga: al guardar se mezcla con lo de afuera.
      if (sucio() || r.current.guardando) return;
      void window.aos.repo.read(ruta).then((t) => vivo && !sucio() && !r.current.guardando && t !== r.current.base && cargar(t), () => {});
    });
    return () => {
      vivo = false;
      r.current.montado = false;
      quitar();
      void guardarRef.current(); // al salir se guarda de inmediato (lee el lienzo antes de que se desmonte)
    };
  }, [ruta]);

  const cambiarModo = async (m: Modo) => {
    await guardar();
    if (!sucio()) cargar(r.current.base, m);
  };

  const avisoPesada = () => setAviso("La imagen pesa más de 2 MB. Súbela a Drive y pega el link");
  const subirImagen = async (file: File): Promise<string> => {
    if (file.size > MAX_IMAGEN) {
      avisoPesada();
      throw new Error("imagen muy pesada");
    }
    const primera = rutaAdjunto(ruta, file.name, fechaLocal());
    let destino = primera;
    for (let n = 2; (await window.aos.repo.list(destino)).length; n++) destino = primera.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
    await window.aos.repo.writeBase64(destino, await aBase64(file));
    return relativa(ruta, destino);
  };

  const enlace: Enlace = {
    onCambio: programar,
    onListo: (leer) => Object.assign(r.current, { leer, visto: leer() }),
    onSoltar: (leer) => { if (r.current.leer === leer) r.current.leer = null; },
  };

  if (base === null) return aviso ? <p role="alert" className="aviso-editor">⚠ {aviso}</p> : null;
  const { meta } = separar(base);
  const exigido = modoInicial(base) !== "visual";
  return (
    <article className="doc">
      {/* Si el cuerpo ya abre con "# Título", ese es el título: no se repite. */}
      {!/^#\s/.test(separar(base).cuerpo.trimStart()) && <h1 className="doc-titulo">{titulo(ruta)}</h1>}
      <div className="guardado" role="status">
        {estado === "guardado" ? <span className="ok">✓ Guardado</span> : <span>{estado === "guardando" ? "Guardando…" : "● Sin guardar"}</span>}
        {ultimo && <span>Editado por {autor(ultimo, indice.personas)} {hace(ultimo.fecha, new Date())}</span>}
        {onHistorial && <button className="btn plano historial" onClick={onHistorial}>Historial</button>}
        {!exigido && (
          <button className="btn plano" onClick={() => void cambiarModo(modo === "visual" ? "markdown" : "visual")}>
            {modo === "visual" ? "Ver como markdown" : "Ver como documento"}
          </button>
        )}
      </div>
      {exigido && <p className="nota-crudo">ⓘ Este documento tiene partes que el editor visual no entiende; lo abrí como markdown.</p>}
      {meta && modo !== "archivo" && (
        <Etiquetas meta={{ ...meta, ...cambiosVista }} onCambiar={(k, v) => {
          r.current.cambios = { ...r.current.cambios, [k]: v };
          setCambiosVista(r.current.cambios);
          programar();
        }} />
      )}
      {conflicto && (
        <div className="aviso-editor" role="alert">
          <span>⚠ Cambió mientras editabas: revisa. Quedaron las dos versiones, la tuya primero.</span>
          <button className="btn" aria-disabled={!onPedirClaude} disabled={!onPedirClaude}
            onClick={() => onPedirClaude?.(`En ${ruta} quedaron dos versiones de un bloque porque se editó al mismo tiempo. Mézclalas en una sola.`)}>
            Pedirle a Claude que lo mezcle
          </button>
          <button className="x" aria-label="Cerrar aviso" onClick={() => setConflicto(false)}>×</button>
        </div>
      )}
      {aviso && (
        <div className="aviso-editor" role="alert">
          <span>⚠ {aviso}</span>
          <button className="x" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>×</button>
        </div>
      )}
      {modo === "visual" ? (
        <Lienzo key={version} inicial={textoDe(base, modo)} ruta={ruta} {...enlace}
          subirImagen={subirImagen} onImagenPesada={avisoPesada} onPedirClaude={onPedirClaude} />
      ) : (
        <Crudo key={version} inicial={textoDe(base, modo)} {...enlace} />
      )}
    </article>
  );
}

/** Edición como markdown: un textarea con el cuerpo (o el archivo entero si el frontmatter está roto). */
function Crudo({ inicial, onCambio, onListo, onSoltar }: Enlace & { inicial: string }) {
  const caja = useRef<HTMLTextAreaElement>(null);
  const enlace = useRef({ onListo, onSoltar });
  useEffect(() => {
    const el = caja.current!; // se guarda el elemento: al desmontar, el ref ya está en null cuando el Editor lee
    const leer = () => el.value;
    enlace.current.onListo(leer);
    return () => enlace.current.onSoltar(leer);
  }, []);
  return <textarea ref={caja} className="crudo" aria-label="Contenido en markdown" defaultValue={inicial} spellCheck onInput={onCambio} />;
}

function aBase64(file: File): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(",")[1] ?? "");
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(file);
  });
}
