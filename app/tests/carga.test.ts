import { describe, expect, it } from "vitest";
import { carga, LIMITE_ALTA } from "../ui/datos/carga";
import type { Indice } from "../ui/datos/indice";
import type { Entregable } from "../ui/datos/tipos";

const HOY = "2026-10-28";
let n = 0;
const tarea = (responsable: string, o: Partial<Entregable> = {}): Entregable =>
  ({ ruta: `clientes/donnas/entregables/t${n++}.md`, cliente: "donnas", formato: "post", vence: "2026-10-30", estado: "en_curso", responsable, ...o });
const persona = (slug: string, nombre: string) => ({ ruta: `equipo/${slug}.md`, slug, nombre, rol: "", nivel_automatizacion: "" });
const indice = (entregables: Entregable[]) => ({
  clientes: [], reuniones: [], decisiones: [], aprobaciones: [], etiquetas: [], rotos: [],
  personas: [persona("jorge", "Jorge"), persona("cami", "Cami")], entregables,
}) as unknown as Indice;

describe("carga", () => {
  const i = indice([
    ...Array.from({ length: 6 }, () => tarea("cami")),
    tarea("cami", { estado: "brief" }),
    tarea("cami", { vence: "2026-10-25" }), // atrasada dentro de la semana
    tarea("cami", { vence: "2026-10-01" }), // atrasada de antes: igual cuenta
    tarea("cami", { vence: "2026-11-20" }), // fuera de la semana
    tarea("cami", { estado: "publicado" }),
    tarea("cami", { estado: "cancelado" }),
    tarea("cami", { estado: "publicado", vence: "2026-10-01" }),
    ...Array.from({ length: 3 }, () => tarea("jorge")),
    tarea("ia"),
  ]);

  it("cami primero, con alta y sus atrasadas; jorge después; Claude también", () => {
    const filas = carga(i, HOY);
    expect(filas.map((f) => f.slug)).toEqual(["cami", "jorge", "ia"]);
    expect(filas[0]).toMatchObject({ nombre: "Cami", total: 9, atrasadas: 2, alta: true, porEstado: { en_curso: 8, brief: 1 } });
    expect(filas[1]).toMatchObject({ nombre: "Jorge", total: 3, atrasadas: 0, alta: false });
    expect(filas[2]).toMatchObject({ nombre: "Claude", total: 1 });
  });

  it("lo publicado o cancelado no cuenta", () => {
    const solo = carga(indice([tarea("jorge", { estado: "publicado" }), tarea("jorge", { estado: "cancelado" })]), HOY);
    expect(solo.find((f) => f.slug === "jorge")).toMatchObject({ total: 0, atrasadas: 0, porEstado: {} });
  });

  it("alta desde el límite", () => {
    const justo = carga(indice(Array.from({ length: LIMITE_ALTA }, () => tarea("jorge"))), HOY);
    expect(LIMITE_ALTA).toBe(8);
    expect(justo[0]).toMatchObject({ slug: "jorge", alta: true });
  });
});
