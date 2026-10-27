import { useEffect, useState } from "react";
import { ElegirPersona } from "./componentes/ElegirPersona";
import { Lateral, type Pantalla } from "./componentes/Lateral";
import { fechaLocal, titulo } from "./datos/hoy";
import { SesionCtx, useIndice } from "./datos/sesion";
import { Hoy } from "./pantallas/Hoy";

const aviso = new URLSearchParams(location.search).get("aviso");

export function App() {
  const { indice, error, reintentar } = useIndice();
  // undefined = aún leyendo; null = nadie eligió persona.
  const [persona, setPersona] = useState<string | null | undefined>(undefined);
  const [eligiendo, setEligiendo] = useState(false);
  const [pantalla, ir] = useState<Pantalla>({ nombre: "hoy" });
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
      <div className="app">
        <Lateral pantalla={pantalla} ir={ir} fecha={fecha} onCambiarPersona={() => setEligiendo(true)} />
        {pantalla.nombre === "hoy" && <Hoy fecha={fecha} onEditar={(ruta) => ir({ nombre: "editar", ruta })} />}
        {pantalla.nombre === "editar" && <Editar ruta={pantalla.ruta} onVolver={() => ir({ nombre: "hoy" })} />}
      </div>
    </SesionCtx.Provider>
  );
}

/** Provisional: muestra el archivo tal cual. El editor de verdad llega después. */
function Editar({ ruta, onVolver }: { ruta: string; onVolver: () => void }) {
  const [texto, setTexto] = useState("");
  useEffect(() => void window.aos.repo.read(ruta).then(setTexto, () => setTexto("")), [ruta]);
  return (
    <main className="principal editar">
      <button className="btn plano" onClick={onVolver}>‹ Volver a Hoy</button>
      <h1 className="titulo" style={{ marginTop: 12 }}>{titulo(ruta)}</h1>
      <p className="bajada">{ruta}</p>
      <pre>{texto}</pre>
    </main>
  );
}
