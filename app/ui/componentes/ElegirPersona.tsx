import { useState } from "react";
import { colorPara } from "../datos/hoy";
import type { Persona } from "../datos/tipos";

/** Primera pantalla si no hay `AOS_PERSONA`: nunca se muestra el Hoy de otra persona. */
export function ElegirPersona({ personas, onElegida, onCancelar }: {
  personas: Persona[]; onElegida: (slug: string) => void; onCancelar?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const elegir = (slug: string) =>
    window.aos.guardarPersona(slug).then(() => onElegida(slug), () => setError("No pude guardar tu elección. Revisa .claude/settings.local.json."));
  return (
    <main className="elegir">
      <div className="elegir-caja">
        <h1 className="titulo">¿Quién eres?</h1>
        <p className="bajada">Elige tu nombre para ver lo que te toca hoy. Lo puedes cambiar cuando quieras.</p>
        {personas.length === 0 && (
          <p className="vacio">No hay nadie en equipo/personas. Pídele a Claude que te agregue al equipo y vuelve a abrir la app.</p>
        )}
        <ul>
          {personas.map((p) => (
            <li key={p.slug}>
              <button className="fila" onClick={() => void elegir(p.slug)}>
                <span className="av" style={{ background: colorPara(p.slug) }} aria-hidden>{p.nombre[0]}</span>
                <span><span className="t">{p.nombre}</span><span className="sub">{p.rol}</span></span>
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="error" role="alert">{error}</p>}
        {onCancelar && <button className="btn plano" style={{ marginTop: 14 }} onClick={onCancelar}>Volver</button>}
      </div>
    </main>
  );
}
