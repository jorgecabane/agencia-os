import { useEffect, useRef, useState } from "react";
import { Chat, type Pedido } from "./componentes/Chat";
import { Editor } from "./componentes/Editor";
import { ElegirPersona } from "./componentes/ElegirPersona";
import { Lateral, type Pantalla } from "./componentes/Lateral";
import { clienteDeRuta, colorPara, fechaLocal, titulo } from "./datos/hoy";
import { SesionCtx, useIndice } from "./datos/sesion";
import { Cliente } from "./pantallas/Cliente";
import { Hoy } from "./pantallas/Hoy";
import { Tablero } from "./pantallas/Tablero";

const aviso = new URLSearchParams(location.search).get("aviso");
const GLOBAL = { contextoId: "global", contexto: "Todo el espacio" };

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
  return { cajon, cerrar, pedir };
}

export function App() {
  const { indice, error, reintentar } = useIndice();
  // undefined = aún leyendo; null = nadie eligió persona.
  const [persona, setPersona] = useState<string | null | undefined>(undefined);
  const [eligiendo, setEligiendo] = useState(false);
  const [pantalla, ir] = useState<Pantalla>({ nombre: "hoy" });
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const { cajon, cerrar, pedir } = useCajon();
  useEffect(() => void window.aos.persona().then(setPersona, () => setPersona(null)), []);

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
  const nombreCliente = (slug: string) => indice.clientes.find((c) => c.slug === slug)?.nombre ?? slug;
  const nombreDe = (p: typeof desde) => (p.nombre === "hoy" ? "Hoy" : p.nombre === "tablero" ? "Tablero" : nombreCliente(p.slug));
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
        {pantalla.nombre === "cliente" && <Cliente key={pantalla.slug} slug={pantalla.slug} fecha={fecha} onErrorFuera={setErrorGuardar} onPedirClaude={pedir} />}
        {pantalla.nombre === "editar" && (
          <main className="principal editar">
            <button className="btn plano" onClick={() => ir(pantalla.desde)}>‹ Volver a {nombreDe(pantalla.desde)}</button>
            <Editor key={pantalla.ruta} ruta={pantalla.ruta} onErrorFuera={setErrorGuardar} onPedirClaude={(t) => pedir(t, pantalla.ruta)} />
          </main>
        )}
        {cajon && (
          <Chat key={cajon.contextoId} {...cajon} etiqueta={etiquetaDe(cajon.contexto)} onAbrir={editar} onCerrar={cerrar}
            color={clienteDeRuta(`${cajon.contexto}/`) ? colorPara(clienteDeRuta(`${cajon.contexto}/`)!) : undefined} />
        )}
      </div>
    </SesionCtx.Provider>
  );
}
