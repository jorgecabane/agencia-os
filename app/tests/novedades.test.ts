import { expect, it } from "vitest";
import type { Commit } from "../shared/puente";
import { novedades } from "../ui/datos/novedades";

const c = (autor: string, email: string, rutas: string[]): Commit => ({
  hash: "a", autor, email, fecha: "2026-10-27T10:00:00-03:00", mensaje: "app: x", rutas,
});

it("agrupa por persona, nombra lo que cambió y omite mis commits", () => {
  const frases = novedades([
    c("jorge", "jorge@a.cl", ["clientes/acme/entregables/2026-10-30-carrusel-lanzamiento.md"]),
    c("jorge", "jorge@a.cl", ["clientes/acme/entregables/2026-10-30-carrusel-lanzamiento.md", "sesiones/x.md"]),
    c("Cami", "cami@a.cl", ["clientes/acme/entregables/2026-10-27-post-martes.md"]),
    c("seba", "seba@a.cl", ["clientes/beta/reuniones/2026-10-26-kickoff.md", "clientes/beta/contexto.md"]),
  ], "cami@a.cl", [{ ruta: "equipo/personas/jorge.md", nombre: "Jorge", slug: "jorge", rol: "x", nivel_automatizacion: "alto" }]);
  expect(frases).toEqual([
    "Jorge cambió “Carrusel lanzamiento” (acme)",
    "seba cambió una reunión de beta y contexto de beta",
  ]);
});

it("resume cuando son muchas cosas", () => {
  const rutas = ["a", "b", "c", "d"].map((x) => `clientes/acme/entregables/2026-10-30-${x}.md`);
  expect(novedades([c("jorge", "j@a.cl", rutas)], "yo@a.cl")).toEqual(["jorge cambió “A” (acme), “B” (acme) y 2 más"]);
});
