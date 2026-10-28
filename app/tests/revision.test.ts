import { describe, expect, it } from "vitest";
import { construirIndice } from "../ui/datos/indice";
import { confirmarActa, deActa, porConfirmar, porRevisar } from "../ui/datos/revision";

const acta = (cliente: string, fecha: string, extra = "") =>
  `---\ntipo: reunion\ncliente: ${cliente}\nfecha: ${fecha}\n${extra}---\n# Acta\n`;
const cliente = (slug: string, responsable: string) =>
  `---\ntipo: cliente\nnombre: ${slug}\nslug: ${slug}\netapa: activo\nmodalidad: retainer\nresponsable: ${responsable}\n---\n`;
const ACTA = "clientes/acme/reuniones/2026-10-27-x.md";
const i = construirIndice(new Map([
  ["clientes/acme/_ficha.md", cliente("acme", "jorge")],
  ["clientes/otro/_ficha.md", cliente("otro", "cami")],
  [ACTA, acta("acme", "2026-10-27")],
  ["clientes/acme/reuniones/2026-10-26-y.md", acta("acme", "2026-10-26T13:00Z")],
  ["clientes/acme/reuniones/2026-10-25-revisada.md", acta("acme", "2026-10-25", "revisada: true\n")],
  ["clientes/acme/reuniones/2026-10-08-vieja.md", acta("acme", "2026-10-08")],
  ["clientes/otro/reuniones/2026-10-27-ajena.md", acta("otro", "2026-10-27", "asistentes: [cami]\n")],
  ["clientes/otro/reuniones/2026-10-26-conmigo.md", acta("otro", "2026-10-26", "asistentes: [cami, jorge]\n")],
  ["clientes/acme/entregables/2026-10-30-post.md",
    `---\ntipo: entregable\ncliente: acme\nformato: post\nvence: 2026-10-30\nestado: brief\nresponsable: jorge\norigen: "[[clientes/acme/reuniones/2026-10-27-x]]"\n---\n`],
  ["clientes/acme/entregables/2026-10-31-otro.md",
    `---\ntipo: entregable\ncliente: acme\nformato: post\nvence: 2026-10-31\nestado: brief\nresponsable: jorge\norigen: "[[clientes/acme/reuniones/2026-10-26-y]]"\n---\n`],
]));

describe("porRevisar", () => {
  it("sin revisadas, sin las de hace 20 días ni las ajenas; la más nueva primero", () => {
    expect(porRevisar(i, "jorge", "2026-10-28").map((r) => r.ruta)).toEqual([
      ACTA, "clientes/acme/reuniones/2026-10-26-y.md", "clientes/otro/reuniones/2026-10-26-conmigo.md",
    ]);
  });
});

describe("deActa", () => {
  it("encuentra la tarea cuyo origen apunta al acta", () => {
    const acta = i.reuniones.find((r) => r.ruta === ACTA)!;
    expect(deActa(i, acta).tareas.map((e) => e.ruta)).toEqual(["clientes/acme/entregables/2026-10-30-post.md"]);
  });
});

describe("confirmarActa", () => {
  it("sin descartadas escribe solo revisada: true en el acta", async () => {
    const archivos: Record<string, string> = { [ACTA]: acta("acme", "2026-10-27") };
    const escritos: Record<string, string> = {};
    (globalThis as { window?: unknown }).window = { aos: { repo: {
      read: async (r: string) => archivos[r],
      write: async (r: string, c: string) => void (escritos[r] = c),
    } } };
    await confirmarActa(i.reuniones.find((r) => r.ruta === ACTA)!, []);
    expect(escritos).toEqual({ [ACTA]: acta("acme", "2026-10-27", "revisada: true\n") });
  });
});

describe("porConfirmar", () => {
  it("pluraliza y omite lo que es cero", () => {
    expect(porConfirmar(2, 3)).toBe("2 decisiones y 3 tareas nuevas por confirmar");
    expect(porConfirmar(0, 1)).toBe("1 tarea nueva por confirmar");
    expect(porConfirmar(0, 0)).toBe("Sin tareas nuevas: márcala como revisada");
  });
});
