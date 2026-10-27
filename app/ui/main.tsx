import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./tokens.css";
import "./app.css";

/** Un error de la interfaz muestra qué pasó y cómo seguir, en vez de dejar la ventana en negro. */
class Caida extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="elegir" role="alert">
        <div className="elegir-caja">
          <h1 className="titulo">Algo falló en la pantalla</h1>
          <p className="bajada">{this.state.error.message}. Tus archivos están a salvo: lo guardado ya está en el repo.</p>
          <button className="btn pri" onClick={() => window.aos.sistema.recargar()}>Recargar</button>
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <Caida><App /></Caida>
  </StrictMode>,
);
