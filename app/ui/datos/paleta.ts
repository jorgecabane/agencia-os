import type { Pantalla } from "../componentes/Lateral";
import { cuando, diaDe, hoy as hoyDe, titulo } from "./hoy";
import type { Indice } from "./indice";

export type Accion =
  | { tipo: "ir"; pantalla: Pantalla } | { tipo: "abrir"; ruta: string }
  | { tipo: "nueva"; cliente?: string } | { tipo: "claude"; texto: string };
export type Opcion = {
  id: string; grupo: "Clientes" | "Tareas" | "Reuniones" | "Ir a" | "Acciones"; titulo: string; detalle?: string; accion: Accion;
};

const MAX = 5;
const CERRADOS = new Set(["publicado", "cancelado"]);
// Equipo se suma con su pantalla (Task 8): hoy sería un link muerto.
const IR: [string, Pantalla][] = [
  ["Hoy", { nombre: "hoy" }], ["Tablero", { nombre: "tablero" }], ["Calendario", { nombre: "calendario" }],
  ["Aprobaciones", { nombre: "aprobaciones" }], ["Configuración", { nombre: "config" }],
];
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Lo que ofrece ⌘K para `q`: clientes, tareas abiertas, reuniones, pantallas y acciones; hasta 5 por grupo. */
export function buscar(q: string, i: Indice, hoy: string, persona?: string): Opcion[] {
  const n = norm(q);
  const calza = (t: string) => norm(t).includes(n);
  const nombre = (slug: string) => i.clientes.find((c) => c.slug === slug)?.nombre ?? slug;
  const ir: Opcion[] = IR.filter(([t]) => calza(t)).map(([t, pantalla]) => ({ id: `ir:${t}`, grupo: "Ir a", titulo: t, accion: { tipo: "ir", pantalla } }));
  if (!n) return [...ir, { id: "nueva", grupo: "Acciones", titulo: "Nueva tarea", detalle: "⌘N", accion: { tipo: "nueva" } }];

  const calzan = i.clientes.filter((c) => calza(c.nombre) || calza(c.slug));
  const clientes: Opcion[] = calzan.slice(0, MAX).map((c) => ({ id: `c:${c.slug}`, grupo: "Clientes", titulo: c.nombre, accion: { tipo: "ir", pantalla: { nombre: "cliente", slug: c.slug } } }));
  const tareas: Opcion[] = i.entregables
    .filter((e) => !CERRADOS.has(e.estado) && calza(e.titulo ?? titulo(e.ruta)))
    .sort((a, b) => String(a.vence).localeCompare(String(b.vence))).slice(0, MAX)
    .map((e) => ({
      id: e.ruta, grupo: "Tareas", titulo: e.titulo ?? titulo(e.ruta),
      detalle: `${nombre(e.cliente)} · ${cuando(e.vence, hoy).texto}`, accion: { tipo: "abrir", ruta: e.ruta },
    }));
  const reuniones: Opcion[] = i.reuniones
    .filter((r) => calza(r.titulo ?? titulo(r.ruta)))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, MAX)
    .map((r) => ({
      id: r.ruta, grupo: "Reuniones", titulo: r.titulo ?? titulo(r.ruta),
      detalle: `${nombre(r.cliente)} · ${cuando(r.fecha, hoy).texto}`, accion: { tipo: "abrir", ruta: r.ruta },
    }));

  const cliente = calzan[0];
  const deHoy = persona ? hoyDe(i, persona, hoy).reuniones : i.reuniones.filter((r) => diaDe(r.fecha) === hoy);
  const brief = deHoy.find((r) => r.tipo === "brief-reunion");
  const acciones: Opcion[] = [
    cliente
      ? { id: "nueva", grupo: "Acciones", titulo: `Nueva tarea para ${cliente.nombre}`, detalle: "⌘N", accion: { tipo: "nueva", cliente: cliente.slug } }
      : { id: "nueva", grupo: "Acciones", titulo: "Nueva tarea", detalle: "⌘N", accion: { tipo: "nueva" } },
    ...(brief ? [{ id: "brief", grupo: "Acciones", titulo: "Abrir brief de la reunión de hoy", accion: { tipo: "abrir", ruta: brief.ruta } } as Opcion] : []),
    { id: "claude", grupo: "Acciones", titulo: `Preguntarle a Claude: "${q.trim()}"`, accion: { tipo: "claude", texto: q.trim() } },
  ];
  return [...clientes, ...tareas, ...reuniones, ...ir, ...acciones];
}
