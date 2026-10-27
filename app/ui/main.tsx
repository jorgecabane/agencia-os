import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";

const aviso = new URLSearchParams(location.search).get("aviso");

function App() {
  return (
    <main style={{ padding: "48px 28px" }}>
      {aviso && (
        <p role="status" style={{ color: "var(--apagado)", margin: "0 0 16px" }}>
          ⓘ {aviso}
        </p>
      )}
      <h1 style={{ fontFamily: "var(--fuente-titulo)", fontWeight: 400, fontSize: 30, margin: 0 }}>agencia-os</h1>
    </main>
  );
}

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
