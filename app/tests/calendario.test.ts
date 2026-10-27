import { afterEach, expect, it, vi } from "vitest";
import { semanas } from "../ui/datos/calendario";
import { cambiar } from "../ui/datos/md";
import { construirIndice } from "../ui/datos/indice";

const indice = construirIndice(new Map([
  ["clientes/acme/entregables/2026-10-30-carrusel.md", "---\ntipo: entregable\ncliente: acme\nformato: carrusel\nvence: 2026-10-30\nestado: brief\nresponsable: cami\n---\n"],
  ["clientes/beta/entregables/2026-10-30-post.md", "---\ntipo: entregable\ncliente: beta\nformato: post\nvence: 2026-10-30\nestado: brief\nresponsable: jorge\n---\n"],
  ["clientes/acme/reuniones/2026-10-28-kickoff.md", "---\ntipo: reunion\ncliente: acme\nfecha: 2026-10-28T10:00-03:00\nasistentes: [cami]\n---\n"],
]));

it("octubre 2026 empieza el lunes 28 de septiembre y pone el entregable del 30 el viernes", () => {
  const s = semanas(indice, "2026-10", {}, "2026-10-27");
  expect(s[0][0].dia).toBe("2026-09-28");
  expect(s.every((sem) => sem.length === 7)).toBe(true);
  expect(s.at(-1)!.at(-1)!.dia).toBe("2026-11-01");
  const viernes = s.flat().find((d) => d.dia === "2026-10-30")!;
  expect(new Date(`${viernes.dia}T12:00:00Z`).getUTCDay()).toBe(5);
  expect(viernes.items.map((x) => x.ruta)).toContain("clientes/acme/entregables/2026-10-30-carrusel.md");
  expect(s.flat().find((d) => d.dia === "2026-10-28")!.items.map((x) => x.ruta)).toEqual(["clientes/acme/reuniones/2026-10-28-kickoff.md"]);
});

it("respeta los filtros del tablero (también en reuniones)", () => {
  const s = semanas(indice, "2026-10", { clientes: ["beta"] }, "2026-10-27").flat();
  expect(s.flatMap((d) => d.items).map((x) => x.ruta)).toEqual(["clientes/beta/entregables/2026-10-30-post.md"]);
});

afterEach(() => vi.unstubAllGlobals());

it("mover cambia vence y deja recurrencia_fecha igual", async () => {
  const original = "---\ntipo: entregable\ncliente: acme\nformato: post\nvence: 2026-10-30\nrecurrencia_fecha: 2026-10-30\nestado: brief\nresponsable: cami\n---\nCuerpo\n";
  const write = vi.fn(async () => {});
  vi.stubGlobal("window", { aos: { repo: { read: async () => original, write } } });
  await cambiar("clientes/acme/entregables/x.md", { vence: "2026-11-02" }); // lo que hace soltar en el calendario
  expect(write).toHaveBeenCalledWith("clientes/acme/entregables/x.md", original.replace("vence: 2026-10-30", "vence: 2026-11-02"));
});
