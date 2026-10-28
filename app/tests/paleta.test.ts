import { describe, expect, it } from "vitest";
import type { Indice } from "../ui/datos/indice";
import { buscar } from "../ui/datos/paleta";
import type { Entregable } from "../ui/datos/tipos";

const tarea = (ruta: string, o: Partial<Entregable> = {}): Entregable =>
  ({ ruta, cliente: "donnas", formato: "post", vence: "2026-10-29", estado: "brief", responsable: "cami", ...o });
const i = {
  clientes: [
    { ruta: "clientes/donnas/cliente.md", nombre: "Donna's", slug: "donnas", etapa: "activo", modalidad: "fee", responsable: "cami" },
    { ruta: "clientes/loufit/cliente.md", nombre: "Loufit", slug: "loufit", etapa: "activo", modalidad: "fee", responsable: "jorge" },
  ],
  entregables: [
    tarea("clientes/donnas/entregables/2026-10-29-cotizacion.md", { titulo: "Cotización campaña de Navidad" }),
    tarea("clientes/donnas/entregables/2026-10-20-viejo.md", { titulo: "Cotización vieja", estado: "publicado" }),
    tarea("clientes/loufit/entregables/2026-10-28-reel.md", { cliente: "loufit", titulo: "Reel donna invitada", vence: "2026-10-28" }),
  ],
  reuniones: [
    { ruta: "clientes/donnas/reuniones/2026-10-28-brief.md", tipo: "brief-reunion", cliente: "donnas", fecha: "2026-10-28T13:00:00Z", asistentes: ["cami"] },
  ],
  decisiones: [], personas: [], aprobaciones: [], etiquetas: [], rotos: [],
} as Indice;
const HOY = "2026-10-28";

describe("buscar", () => {
  it("compara sin tildes ni mayúsculas y solo tareas abiertas, con cliente y cuándo", () => {
    const tareas = buscar("COTIZACION", i, HOY).filter((o) => o.grupo === "Tareas");
    expect(tareas.map((o) => o.titulo)).toEqual(["Cotización campaña de Navidad"]);
    expect(tareas[0].detalle).toBe("Donna's · mañana");
    expect(tareas[0].accion).toEqual({ tipo: "abrir", ruta: "clientes/donnas/entregables/2026-10-29-cotizacion.md" });
  });
  it("con un cliente que calza: Clientes primero y Nueva tarea para ese cliente", () => {
    const r = buscar("donna", i, HOY);
    expect(r[0]).toMatchObject({ grupo: "Clientes", titulo: "Donna's", accion: { tipo: "ir", pantalla: { nombre: "cliente", slug: "donnas" } } });
    expect(r).toContainEqual(expect.objectContaining({ titulo: "Nueva tarea para Donna's", detalle: "⌘N", accion: { tipo: "nueva", cliente: "donnas" } }));
    expect(r).toContainEqual(expect.objectContaining({ titulo: "Abrir brief de la reunión de hoy", accion: { tipo: "abrir", ruta: "clientes/donnas/reuniones/2026-10-28-brief.md" } }));
  });
  it("la última opción con texto es preguntarle a Claude", () => {
    const r = buscar("qwerty", i, HOY);
    expect(r.at(-1)).toEqual(expect.objectContaining({ titulo: 'Preguntarle a Claude: "qwerty"', accion: { tipo: "claude", texto: "qwerty" } }));
  });
  it("sin texto: solo Ir a y Nueva tarea", () => {
    const r = buscar("  ", i, HOY);
    expect(new Set(r.map((o) => o.grupo))).toEqual(new Set(["Ir a", "Acciones"]));
    expect(r.filter((o) => o.grupo === "Acciones").map((o) => o.titulo)).toEqual(["Nueva tarea"]);
    expect(r.some((o) => o.grupo === "Tareas")).toBe(false);
  });
  it("máximo 5 por grupo", () => {
    const muchas = { ...i, entregables: Array.from({ length: 8 }, (_, k) => tarea(`clientes/donnas/entregables/t${k}.md`, { titulo: `Post ${k}` })) };
    expect(buscar("post", muchas, HOY).filter((o) => o.grupo === "Tareas")).toHaveLength(5);
  });
  it("el brief es de las reuniones de hoy de la persona", () => {
    expect(buscar("x", i, HOY, "jorge").some((o) => o.titulo.startsWith("Abrir brief"))).toBe(false);
    expect(buscar("x", i, HOY, "cami").some((o) => o.titulo.startsWith("Abrir brief"))).toBe(true);
  });
});
