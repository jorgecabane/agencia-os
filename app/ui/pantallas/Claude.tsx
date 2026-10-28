import { MessageSquare, Plus } from "lucide-react";
import { Chat, type Pedido } from "../componentes/Chat";
import { ICONO } from "../componentes/Lateral";
import { type Conversacion, useConversaciones } from "../datos/chat";
import { clienteDeRuta, colorPara, fechaLocal } from "../datos/hoy";
import "./claude.css";

const GENERAL = "Todo el espacio";

/** Contexto de una conversación que aún no tiene turnos: general, nueva, o la ruta/carpeta que es su id. */
function sinTurnos(id: string, etiquetaDe: (contexto: string) => string): Omit<Conversacion, "ultimo" | "hora"> {
  if (id === "global") return { id, contexto: GENERAL, etiqueta: GENERAL };
  if (id.startsWith("nueva-")) return { id, contexto: GENERAL, etiqueta: "Conversación nueva" };
  return { id, contexto: id, etiqueta: etiquetaDe(id) };
}

const colorDe = (contexto: string) => {
  const c = clienteDeRuta(`${contexto}/`);
  return c ? colorPara(c) : undefined;
};

/** Modo trabajo: Claude a pantalla completa, con las conversaciones de esta sesión a la izquierda. */
export function Claude({ id = "global", fecha, pedido, etiquetaDe, onElegir, onAbrir, onAchicar }: {
  id?: string; fecha: string; pedido?: Pedido; etiquetaDe: (contexto: string) => string;
  onElegir: (id: string) => void; onAbrir: (ruta: string) => void; onAchicar: () => void;
}) {
  const todas = useConversaciones();
  const actual = todas.find((c) => c.id === id) ?? sinTurnos(id, etiquetaDe);
  const hoy = todas.filter((c) => fechaLocal(new Date(c.hora)) === fecha);
  const antes = todas.filter((c) => !hoy.includes(c));
  const lista = (titulo: string, cs: Conversacion[]) => cs.length > 0 && (
    <>
      <h2 className="h">{titulo}</h2>
      {cs.map((c) => {
        const color = colorDe(c.contexto);
        return (
          <button key={c.id} className="it" aria-current={c.id === id ? "true" : undefined} onClick={() => onElegir(c.id)} title={c.ultimo}>
            {color ? <span className="dot" style={{ background: color }} aria-hidden /> : <MessageSquare size={ICONO} aria-hidden />}
            <span className="t">{c.etiqueta}</span>
          </button>
        );
      })}
    </>
  );
  return (
    <main className="trabajo">
      <nav className="hilos" aria-label="Conversaciones">
        <button className="btn nueva-conv" onClick={() => onElegir(`nueva-${Date.now()}`)}>
          <Plus size={ICONO} aria-hidden />Conversación nueva
        </button>
        {lista("Hoy", hoy)}
        {lista("Antes", antes)}
      </nav>
      <Chat key={actual.id} contextoId={actual.id} contexto={actual.contexto} etiqueta={actual.etiqueta} color={colorDe(actual.contexto)}
        pedido={pedido} onAbrir={onAbrir} onAchicar={onAchicar} enfocar />
    </main>
  );
}
