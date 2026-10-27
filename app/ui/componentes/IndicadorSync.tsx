import { useEffect, useState } from "react";
import type { Estado } from "../../shared/puente";

const TEXTO: Record<Estado, { icono: string; texto: string; color: string }> = {
  "al-dia": { icono: "✓", texto: "Al día", color: "var(--avance)" },
  subiendo: { icono: "↻", texto: "Sincronizando…", color: "var(--apagado)" },
  "sin-conexion": { icono: "⚠", texto: "Sin conexión, reintento", color: "var(--atraso)" },
  conflicto: { icono: "⚠", texto: "Conflicto: pídele ayuda a Claude", color: "var(--atraso)" },
};

/** Estado del sync con ícono y texto; clic = sincronizar ahora. En conflicto, además, pedirle a Claude que lo mezcle. */
export function IndicadorSync({ onMezclar }: { onMezclar: () => void }) {
  const [estado, setEstado] = useState<Estado>(() => window.aos.sync.estado());
  useEffect(() => window.aos.sync.onEstado(setEstado), []);
  const { icono, texto, color } = TEXTO[estado];
  return (
    <>
      <button className="nav-it" onClick={() => void window.aos.sync.ahora()} title="Sincronizar ahora" aria-live="polite">
        <span aria-hidden style={{ color }}>{icono}</span>
        {texto}
      </button>
      {estado === "conflicto" && (
        <button className="nav-it" onClick={onMezclar}>
          <span aria-hidden>✦</span>Pedirle a Claude que lo mezcle
        </button>
      )}
    </>
  );
}
