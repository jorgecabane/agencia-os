import { useEffect, useState } from "react";
import { Editor } from "./componentes/Editor";
import { ElegirPersona } from "./componentes/ElegirPersona";
import { Lateral, type Pantalla } from "./componentes/Lateral";
import { fechaLocal } from "./datos/hoy";
import { SesionCtx, useIndice } from "./datos/sesion";
import { Cliente } from "./pantallas/Cliente";
import { Hoy } from "./pantallas/Hoy";
import { Tablero } from "./pantallas/Tablero";

const aviso = new URLSearchParams(location.search).get("aviso");

export function App() {
  const { indice, error, reintentar } = useIndice();
  // undefined = aún leyendo; null = nadie eligió persona.
  const [persona, setPersona] = useState<string | null | undefined>(undefined);
  const [eligiendo, setEligiendo] = useState(false);
  const [pantalla, ir] = useState<Pantalla>({ nombre: "hoy" });
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
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
        {pantalla.nombre === "hoy" && <Hoy fecha={fecha} onEditar={(ruta) => ir({ nombre: "editar", ruta, desde: "hoy" })} />}
        {pantalla.nombre === "tablero" && <Tablero fecha={fecha} onEditar={(ruta) => ir({ nombre: "editar", ruta, desde: "tablero" })} />}
        {pantalla.nombre === "cliente" && <Cliente key={pantalla.slug} slug={pantalla.slug} fecha={fecha} onErrorFuera={setErrorGuardar} />}
        {pantalla.nombre === "editar" && (
          <main className="principal editar">
            <button className="btn plano" onClick={() => ir({ nombre: pantalla.desde })}>‹ Volver a {pantalla.desde === "hoy" ? "Hoy" : "Tablero"}</button>
            <Editor key={pantalla.ruta} ruta={pantalla.ruta} onErrorFuera={setErrorGuardar} />
          </main>
        )}
      </div>
    </SesionCtx.Provider>
  );
}
