import { useEffect, useState } from "react";
import { Check, CloudOff, type LucideIcon, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { Estado } from "../../shared/puente";
import { ICONO } from "./Lateral";

const TEXTO: Record<Estado, { Icono: LucideIcon; texto: string; color: string }> = {
  "al-dia": { Icono: Check, texto: "Al día", color: "var(--avance)" },
  subiendo: { Icono: RefreshCw, texto: "Sincronizando…", color: "var(--apagado)" },
  "sin-conexion": { Icono: CloudOff, texto: "Sin conexión, reintento", color: "var(--atraso)" },
  conflicto: { Icono: TriangleAlert, texto: "Conflicto: pídele ayuda a Claude", color: "var(--atraso)" },
};

/** Estado del sync con ícono y texto; clic = sincronizar ahora. En conflicto, además, pedirle a Claude que lo mezcle. */
export function IndicadorSync({ onMezclar }: { onMezclar: () => void }) {
  const [estado, setEstado] = useState<Estado>(() => window.aos.sync.estado());
  useEffect(() => window.aos.sync.onEstado(setEstado), []);
  const { Icono, texto, color } = TEXTO[estado];
  return (
    <>
      <button className="nav-it" onClick={() => void window.aos.sync.ahora()} title="Sincronizar ahora" aria-live="polite">
        <Icono size={ICONO} aria-hidden style={{ color }} />
        {texto}
      </button>
      {estado === "conflicto" && (
        <button className="nav-it" onClick={onMezclar}>
          <Sparkles size={ICONO} aria-hidden />Pedirle a Claude que lo mezcle
        </button>
      )}
    </>
  );
}
