import type { Pantalla } from "../componentes/Lateral";
import { clienteDeRuta, colorPara, titulo } from "./hoy";

export type ContextoChat = { contextoId: string; contexto: string; etiqueta: string };

/** Color del cliente si el contexto es suyo (`clientes/<c>` o un archivo dentro). */
export const colorDeContexto = (contexto: string): string | undefined => {
  const c = clienteDeRuta(`${contexto}/`);
  return c ? colorPara(c) : undefined;
};

const global = (etiqueta: string): ContextoChat => ({ contextoId: "global", contexto: etiqueta, etiqueta });

/** El contexto del chat sigue a la pantalla: un cliente, el archivo abierto o todo el espacio. */
export function contextoDe(p: Pantalla, nombreCliente: (slug: string) => string): ContextoChat {
  if (p.nombre === "cliente") return { contextoId: `clientes/${p.slug}`, contexto: `clientes/${p.slug}`, etiqueta: nombreCliente(p.slug) };
  if (p.nombre === "editar") return { contextoId: p.ruta, contexto: p.ruta, etiqueta: titulo(p.ruta) };
  return global(p.nombre === "hoy" ? "Mi día" : "Todo el espacio");
}
