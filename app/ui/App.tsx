import { useEffect, useRef, useState } from "react";
import { MOTIVO_CONFLICTO, RELEASES } from "../shared/puente";
import { Barra, BarraSinPersona } from "./barra/Barra";
import { Chat } from "./componentes/Chat";
import { Editor } from "./componentes/Editor";
import { ElegirPersona } from "./componentes/ElegirPersona";
import { Lateral, type Pantalla } from "./componentes/Lateral";
import { DialogoNueva, Paleta } from "./componentes/Paleta";
import { colorDeContexto, contextoDe } from "./datos/contexto-chat";
import { useCajon } from "./datos/cajon";
import { clienteDeRuta, fechaLocal, fijarZona, titulo } from "./datos/hoy";
import type { Accion } from "./datos/paleta";
import { APROBACION } from "./datos/pasos";
import { sePuedeRecargar } from "./datos/recarga";
import { SesionCtx, useIndice } from "./datos/sesion";
import { Aprobaciones } from "./pantallas/Aprobaciones";
import { Calendario } from "./pantallas/Calendario";
import { Claude } from "./pantallas/Claude";
import { Cliente } from "./pantallas/Cliente";
import { Config } from "./pantallas/Config";
import { Hoy } from "./pantallas/Hoy";
import { RevisarActa } from "./pantallas/RevisarActa";
import { Tablero } from "./pantallas/Tablero";

const aviso = new URLSearchParams(location.search).get("aviso");
// La ventana de la barra de menú carga la misma UI con #barra.
const BARRA = location.hash === "#barra";
const NOMBRES: Record<string, string> = {
  hoy: "Hoy", tablero: "Tablero", calendario: "Calendario", aprobaciones: "Aprobaciones", config: "Configuración",
  claude: "Claude", equipo: "Equipo", revisar: "Revisar",
};
/** ⌘N pone el cliente si estás en uno. */
const clienteAqui = (p: Pantalla) => (p.nombre === "cliente" ? { cliente: p.slug } : {});

export function App() {
  const { indice, error, reintentar } = useIndice();
  // undefined = aún leyendo; null = nadie eligió persona.
  const [persona, setPersona] = useState<string | null | undefined>(undefined);
  const [eligiendo, setEligiendo] = useState(false);
  const [pantalla, ir] = useState<Pantalla>({ nombre: "hoy" });
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const nombreCliente = (slug: string) => indice?.clientes.find((c) => c.slug === slug)?.nombre ?? slug;
  const { cajon, enfocar, cerrar, ocultar, alternar, pantallaCompleta, pedir, capturar } = useCajon(pantalla, ir, (p) => contextoDe(p, nombreCliente));
  const [nuevaUI, setNuevaUI] = useState(false);
  const [paleta, setPaleta] = useState(false);
  // ⌘N: con el cliente de la pantalla, o el que eligió la paleta.
  const [nueva, setNueva] = useState<{ cliente?: string } | null>(null);
  const actual = useRef(pantalla);
  actual.current = pantalla;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!e.metaKey || (k !== "k" && k !== "n") || BARRA) return;
      e.preventDefault();
      setPaleta(false);
      if (k === "k") setPaleta(true);
      else setNueva(clienteAqui(actual.current));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => window.aos.sistema.onNuevaUI(() => (sePuedeRecargar() ? window.aos.sistema.recargar() : setNuevaUI(true))), []);
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
  fijarZona(indice.personas.find((p) => p.slug === persona)?.zona_horaria);
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
  const nombreDe = (p: typeof desde) => (p.nombre === "cliente" ? nombreCliente(p.slug) : NOMBRES[p.nombre]);
  const ejecutar = (a: Accion) => {
    setPaleta(false);
    if (a.tipo === "ir") ir(a.pantalla);
    else if (a.tipo === "abrir") abrirArchivo(a.ruta);
    else if (a.tipo === "claude") capturar(a.texto); // global y se manda
    else setNueva(a.cliente ? { cliente: a.cliente } : clienteAqui(pantalla));
  };
  const etiquetaDe = (contexto: string) => {
    if (contexto.endsWith(".md")) return titulo(contexto);
    const c = clienteDeRuta(`${contexto}/`);
    return c ? nombreCliente(c) : contexto;
  };
  return (
    <SesionCtx.Provider value={{ indice, persona }}>
      <div className="arrastre" aria-hidden />
      {/* El único aviso del shell es el de marco viejo: se baja de la página de versiones. */}
      {aviso && (
        <p role="status" className="aviso">
          ⓘ {aviso} ·{" "}
          <button className="btn plano" onClick={() => void window.aos.sistema.abrir(RELEASES)}>Descargar la versión nueva</button>
        </p>
      )}
      {nuevaUI && (
        <p role="status" className="aviso">
          ⓘ Hay una versión nueva de la app ·{" "}
          <button className="btn plano" onClick={() => window.aos.sistema.recargar()}>Recargar</button>
        </p>
      )}
      {errorGuardar && (
        <p role="alert" className="aviso error-global">
          ⚠ {errorGuardar}. Lo último que escribiste no quedó guardado.
          <button className="x" aria-label="Cerrar aviso" onClick={() => setErrorGuardar(null)}>×</button>
        </p>
      )}
      <div className="app">
        <Lateral pantalla={pantalla} ir={ir} fecha={fecha} onCambiarPersona={() => setEligiendo(true)}
          onMezclar={() => capturar(MOTIVO_CONFLICTO)} onClaude={alternar} onBuscar={() => setPaleta(true)} />
        {pantalla.nombre === "hoy" && <Hoy fecha={fecha} onEditar={editar} onRevisar={(ruta) => ir({ nombre: "revisar", ruta })} />}
        {pantalla.nombre === "revisar" && <RevisarActa key={pantalla.ruta} ruta={pantalla.ruta} fecha={fecha} onVolver={() => ir({ nombre: "hoy" })}
          onEditar={editar} onPedirClaude={pedir} />}
        {pantalla.nombre === "tablero" && <Tablero key={JSON.stringify(pantalla.filtro ?? null)} fecha={fecha} onEditar={editar} filtroInicial={pantalla.filtro} />}
        {pantalla.nombre === "calendario" && <Calendario fecha={fecha} onEditar={editar} />}
        {pantalla.nombre === "aprobaciones" && <Aprobaciones key={pantalla.ruta} inicial={pantalla.ruta} onEditar={editar} />}
        {pantalla.nombre === "config" && <Config onEditar={editar} onCambiarPersona={() => setEligiendo(true)} />}
        {pantalla.nombre === "cliente" && <Cliente key={pantalla.slug} slug={pantalla.slug} fecha={fecha} onErrorFuera={setErrorGuardar} onPedirClaude={pedir}
          onNuevaTarea={(c) => setNueva({ cliente: c })} />}
        {pantalla.nombre === "editar" && (
          <main className="principal editar">
            <button className="btn plano" onClick={() => ir(pantalla.desde)}>‹ Volver a {nombreDe(pantalla.desde)}</button>
            <Editor key={pantalla.ruta} ruta={pantalla.ruta} onErrorFuera={setErrorGuardar} onPedirClaude={(t) => pedir(t, pantalla.ruta)} />
          </main>
        )}
        {pantalla.nombre === "claude" && (
          <Claude id={pantalla.id} fecha={fecha} pedido={cajon?.pedido} etiquetaDe={etiquetaDe} onAbrir={abrirArchivo}
            onElegir={(id) => ir({ nombre: "claude", id })} onAchicar={pantallaCompleta} />
        )}
        {cajon && pantalla.nombre !== "claude" && (
          <Chat key={cajon.contextoId} {...cajon} etiqueta={cajon.etiqueta ?? etiquetaDe(cajon.contexto)} onAbrir={abrirArchivo}
            onCerrar={cerrar} onOcultar={ocultar} onAgrandar={pantallaCompleta} enfocar={enfocar} color={colorDeContexto(cajon.contexto)} />
        )}
      </div>
      {paleta && <Paleta fecha={fecha} onAccion={ejecutar} onCerrar={() => setPaleta(false)} />}
      {nueva && <DialogoNueva key={nueva.cliente ?? ""} inicial={nueva} onCerrar={() => setNueva(null)} onCreada={(ruta) => { setNueva(null); editar(ruta); }} />}
    </SesionCtx.Provider>
  );
}
