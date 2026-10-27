import { useEffect, useRef, useState } from "react";
import { Barra, BarraSinPersona } from "./barra/Barra";
import { Chat, type Pedido } from "./componentes/Chat";
import { Editor } from "./componentes/Editor";
import { ElegirPersona } from "./componentes/ElegirPersona";
import { Lateral, type Pantalla } from "./componentes/Lateral";
import { clienteDeRuta, colorPara, fechaLocal, titulo } from "./datos/hoy";
import { APROBACION } from "./datos/pasos";
import { SesionCtx, useIndice } from "./datos/sesion";
import { Aprobaciones } from "./pantallas/Aprobaciones";
import { Calendario } from "./pantallas/Calendario";
import { Cliente } from "./pantallas/Cliente";
import { Config } from "./pantallas/Config";
import { Hoy } from "./pantallas/Hoy";
import { Tablero } from "./pantallas/Tablero";

const aviso = new URLSearchParams(location.search).get("aviso");
// La ventana de la barra de menú carga la misma UI con #barra.
const BARRA = location.hash === "#barra";
const GLOBAL = { contextoId: "global", contexto: "Todo el espacio" };
const NOMBRES: Record<string, string> = { hoy: "Hoy", tablero: "Tablero", calendario: "Calendario", aprobaciones: "Aprobaciones", config: "Configuración" };

type Cajon = { contextoId: string; contexto: string; pedido?: Pedido };

/** Chat lateral: ⌘J lo abre o cierra con "Todo el espacio"; los "Pedirle a Claude" lo abren con su contexto. */
function useCajon() {
  const [cajon, setCajon] = useState<Cajon | null>(null);
  const origen = useRef<Element | null>(null); // al cerrar, el foco vuelve a donde estaba
  const abrir = (c: Cajon) => {
    if (!origen.current) origen.current = document.activeElement;
    setCajon(c);
  };
  const cerrar = () => {
    setCajon(null);
    (origen.current as HTMLElement | null)?.focus?.();
    origen.current = null;
  };
  const alternar = useRef(() => {});
  alternar.current = () => (cajon ? cerrar() : abrir(GLOBAL));
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!e.metaKey || e.key.toLowerCase() !== "j") return;
      e.preventDefault();
      alternar.current();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const pedir = (texto: string, contexto: string) => abrir({ contextoId: contexto, contexto, pedido: { texto } });
  const capturar = (texto: string) => abrir({ ...GLOBAL, pedido: { texto } });
  return { cajon, cerrar, pedir, capturar };
}

export function App() {
  const { indice, error, reintentar } = useIndice();
  // undefined = aún leyendo; null = nadie eligió persona.
  const [persona, setPersona] = useState<string | null | undefined>(undefined);
  const [eligiendo, setEligiendo] = useState(false);
  const [pantalla, ir] = useState<Pantalla>({ nombre: "hoy" });
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const { cajon, cerrar, pedir, capturar } = useCajon();
  useEffect(() => {
    const leer = () => void window.aos.persona().then(setPersona, () => setPersona(null));
    leer();
    if (!BARRA) return;
    window.addEventListener("focus", leer); // la persona se elige en la ventana principal
    return () => window.removeEventListener("focus", leer);
  }, []);
  // Lo que piden la barra o un aviso: abrir un archivo o mandar una captura rápida al chat.
  useEffect(() => {
    if (BARRA) return;
    return window.aos.sistema.onPedido((p) => {
      if ("captura" in p) return capturar(p.captura);
      if (APROBACION.test(p.ruta)) return ir({ nombre: "aprobaciones", ruta: p.ruta });
      ir((actual) => ({ nombre: "editar", ruta: p.ruta, desde: actual.nombre === "editar" ? actual.desde : actual }));
    });
  }, []);

  if (error) {
    return (
      <main className="elegir" role="alert">
        <div className="elegir-caja">
          <h1 className="titulo">No pude leer el repo</h1>
          <p className="bajada">{error}</p>
          <button className="btn pri" onClick={reintentar}>Reintentar</button>
        </div>
      </main>
    );
  }
  if (!indice || persona === undefined) return null;
  if (BARRA) {
    return persona ? <SesionCtx.Provider value={{ indice, persona }}><Barra /></SesionCtx.Provider> : <BarraSinPersona />;
  }
  if (!persona || eligiendo) {
    return (
      <ElegirPersona
        personas={indice.personas}
        onElegida={(slug) => { setPersona(slug); setEligiendo(false); }}
        onCancelar={persona ? () => setEligiendo(false) : undefined}
      />
    );
  }
  const fecha = fechaLocal();
  const desde = pantalla.nombre === "editar" ? pantalla.desde : pantalla;
  const editar = (ruta: string) => ir({ nombre: "editar", ruta, desde });
  // Los borradores para aprobar se revisan en Aprobaciones, no en el editor.
  const abrirArchivo = (ruta: string) => (APROBACION.test(ruta) ? ir({ nombre: "aprobaciones", ruta }) : editar(ruta));
  const nombreCliente = (slug: string) => indice.clientes.find((c) => c.slug === slug)?.nombre ?? slug;
  const nombreDe = (p: typeof desde) => (p.nombre === "cliente" ? nombreCliente(p.slug) : NOMBRES[p.nombre]);
  const etiquetaDe = (contexto: string) => {
    if (contexto.endsWith(".md")) return titulo(contexto);
    const c = clienteDeRuta(`${contexto}/`);
    return c ? nombreCliente(c) : contexto;
  };
  return (
    <SesionCtx.Provider value={{ indice, persona }}>
      <div className="arrastre" aria-hidden />
      {aviso && <p role="status" className="aviso">ⓘ {aviso}</p>}
      {errorGuardar && (
        <p role="alert" className="aviso error-global">
          ⚠ {errorGuardar}. Lo último que escribiste no quedó guardado.
          <button className="x" aria-label="Cerrar aviso" onClick={() => setErrorGuardar(null)}>×</button>
        </p>
      )}
      <div className="app">
        <Lateral pantalla={pantalla} ir={ir} fecha={fecha} onCambiarPersona={() => setEligiendo(true)} />
        {pantalla.nombre === "hoy" && <Hoy fecha={fecha} onEditar={editar} />}
        {pantalla.nombre === "tablero" && <Tablero fecha={fecha} onEditar={editar} />}
        {pantalla.nombre === "calendario" && <Calendario fecha={fecha} onEditar={editar} />}
        {pantalla.nombre === "aprobaciones" && <Aprobaciones key={pantalla.ruta} inicial={pantalla.ruta} onEditar={editar} />}
        {pantalla.nombre === "config" && <Config onEditar={editar} onCambiarPersona={() => setEligiendo(true)} />}
        {pantalla.nombre === "cliente" && <Cliente key={pantalla.slug} slug={pantalla.slug} fecha={fecha} onErrorFuera={setErrorGuardar} onPedirClaude={pedir} />}
        {pantalla.nombre === "editar" && (
          <main className="principal editar">
            <button className="btn plano" onClick={() => ir(pantalla.desde)}>‹ Volver a {nombreDe(pantalla.desde)}</button>
            <Editor key={pantalla.ruta} ruta={pantalla.ruta} onErrorFuera={setErrorGuardar} onPedirClaude={(t) => pedir(t, pantalla.ruta)} />
          </main>
        )}
        {cajon && (
          <Chat key={cajon.contextoId} {...cajon} etiqueta={etiquetaDe(cajon.contexto)} onAbrir={abrirArchivo} onCerrar={cerrar}
            color={clienteDeRuta(`${cajon.contexto}/`) ? colorPara(clienteDeRuta(`${cajon.contexto}/`)!) : undefined} />
        )}
      </div>
    </SesionCtx.Provider>
  );
}
