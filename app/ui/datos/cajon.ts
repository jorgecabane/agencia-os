import { useEffect, useRef, useState } from "react";
import type { Pedido } from "../componentes/Chat";
import type { Pantalla } from "../componentes/Lateral";
import type { ContextoChat } from "./contexto-chat";

export type Cajon = Omit<ContextoChat, "etiqueta"> & { etiqueta?: string; pedido?: Pedido };
const GLOBAL = { contextoId: "global", contexto: "Todo el espacio" };
/** Con un panel de tarea abierto, ⌘J y "Claude ⌘J" enfocan su chat (el cajón está oculto, ver app.css). */
export const ENFOCAR_CHAT_PANEL = "aos:enfocar-chat-panel";

/**
 * Chat de la derecha. Arranca según `chatAbierto` (cerrado hasta leer la config) y su contexto sigue a la pantalla.
 * ⌘J lo abre o cierra y guarda la preferencia; ⌘⇧J alterna la pantalla completa (modo Claude).
 * Un "Pedirle a Claude" lo abre con su propio contexto mientras no cambie la pantalla, sin tocar la preferencia.
 */
export function useCajon(pantalla: Pantalla, ir: (p: Pantalla) => void, contextoDe: (p: Pantalla) => ContextoChat) {
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState<{ cajon: Cajon; en: Pantalla } | null>(null);
  const [foco, setFoco] = useState<Pantalla | null>(null); // la pantalla donde la persona lo abrió recién: ahí enfoca la entrada
  const ahora = useRef(pantalla);
  ahora.current = pantalla;
  const antes = useRef<Pantalla>({ nombre: "hoy" }); // a dónde vuelve "Volver al costado"
  const origen = useRef<Element | null>(null); // al cerrar, el foco vuelve a donde estaba
  useEffect(() => void window.aos.config.leer().then((c) => setAbierto(c.chatAbierto), () => setAbierto(true)), []);
  // El pedido vale solo en su pantalla: al volver a ella, el Chat nuevo no debe reenviarlo.
  useEffect(() => { if (pedido && pedido.en !== pantalla) setPedido(null); }, [pantalla]);

  const enModoClaude = pantalla.nombre === "claude";
  const cajon: Cajon | null = pedido?.en === pantalla ? pedido.cajon : abierto || enModoClaude ? contextoDe(pantalla) : null;
  const guardar = (v: boolean, persistir = true) => {
    setAbierto(v);
    if (persistir) window.aos.config.guardar({ chatAbierto: v }).catch(() => {}); // si no se guarda, solo se pierde la preferencia
  };
  const abrir = () => {
    origen.current ??= document.activeElement;
    setFoco(ahora.current);
    guardar(true);
  };
  /** ⌘J y × guardan la preferencia; Escape (`persistir` false) solo lo cierra por ahora. */
  const cerrar = (persistir = true) => {
    setPedido(null);
    guardar(false, persistir);
    if (ahora.current.nombre === "claude") ir(antes.current);
    (origen.current as HTMLElement | null)?.focus?.();
    origen.current = null;
  };
  const pantallaCompleta = () => {
    if (ahora.current.nombre === "claude") {
      setFoco(antes.current);
      ir(antes.current);
      return guardar(true);
    }
    antes.current = ahora.current;
    ir({ nombre: "claude", id: cajon?.contextoId ?? contextoDe(ahora.current).contextoId });
  };
  const pedirCon = (c: Cajon) => {
    let en = ahora.current;
    if (en.nombre === "claude") {
      en = { nombre: "claude", id: c.contextoId };
      ir(en);
    }
    origen.current ??= document.activeElement;
    setPedido({ cajon: c, en });
    setFoco(en);
  };
  const pedir = (texto: string, contexto: string) => pedirCon({ contextoId: contexto, contexto, pedido: { texto } });
  const capturar = (texto: string) => pedirCon({ ...GLOBAL, pedido: { texto } });
  const alternar = () => {
    if (document.querySelector(".panel") && !cajon?.pedido) return void window.dispatchEvent(new Event(ENFOCAR_CHAT_PANEL));
    return cajon ? cerrar() : abrir();
  };

  const teclas = useRef({ alternar, pantallaCompleta });
  teclas.current = { alternar, pantallaCompleta };
  useEffect(() => {
    if (location.hash === "#barra") return; // la ventana de la barra de menú no tiene cajón
    const tecla = (e: KeyboardEvent) => {
      if (!e.metaKey || e.key.toLowerCase() !== "j") return;
      e.preventDefault();
      if (e.shiftKey) teclas.current.pantallaCompleta();
      else teclas.current.alternar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const ocultar = () => cerrar(false);
  return { cajon, enfocar: foco === pantalla, cerrar: () => cerrar(), ocultar, alternar, pantallaCompleta, pedir, capturar };
}
