import { describe, expect, it } from "vitest";
import { agenda, avisosPendientes, cuentaRegresiva, siguienteEstado } from "../ui/datos/agenda";
import { construirIndice } from "../ui/datos/indice";

const ficha = `---\ntipo: cliente\nnombre: Donna's\nslug: donnas\netapa: activo\nmodalidad: retainer\nresponsable: cami\n---\n`;
const reu = (tipo: string, fecha: string, asistentes: string, extra = "") =>
  `---\ntipo: ${tipo}\ncliente: donnas\nfecha: ${fecha}\nasistentes: [${asistentes}]\n${extra}---\n`;
const ent = (vence: string, responsable = "cami", extra = "") =>
  `---\ntipo: entregable\ncliente: donnas\nformato: post\nvence: ${vence}\nestado: en_curso\nresponsable: ${responsable}\n${extra}---\n`;

const R = "clientes/donnas/reuniones/";
const E = "clientes/donnas/entregables/";
const ACTA = `${R}2026-10-27-revision-mensual`;
const i = construirIndice(new Map([
  ["clientes/donnas/_ficha.md", ficha],
  [`${R}2026-10-27-revision-mensual-brief.md`, reu("brief-reunion", "2026-10-27T17:00-03:00", "cami, jorge", "link: https://meet.google.com/abc\n")],
  [`${R}2026-10-27-kickoff.md`, reu("brief-reunion", "2026-10-27T18:30-03:00", "cami")],
  [`${R}2026-10-27-temprano.md`, reu("brief-reunion", "2026-10-27T09:00-03:00", "cami")],
  [`${ACTA}.md`, reu("reunion", "2026-10-27T11:00-03:00", "cami, jorge")],
  [`${R}2026-10-27-sin-mi.md`, reu("reunion", "2026-10-27T12:00-03:00", "jorge")],
  [`${E}2026-10-27-post.md`, ent("2026-10-27", "cami", `origen: "[[${ACTA}]]"\n`)],
  [`${E}2026-10-30-carrusel.md`, ent("2026-10-30", "jorge", `origen: "[[${ACTA}]]"\n`)],
  [`${E}2026-10-20-dms.md`, ent("2026-10-20")],
]));
const ahora = new Date("2026-10-27T16:52-03:00");

describe("agenda", () => {
  it("a las 16:52 la próxima es la de las 17:00, en 8 minutos", () => {
    const a = agenda(i, "cami", ahora);
    expect(a.proxima?.ruta).toBe(`${R}2026-10-27-revision-mensual-brief.md`);
    expect(cuentaRegresiva(a.proxima!.fecha, ahora)).toBe("En 8 minutos");
    expect(a.masTarde.map((r) => r.ruta)).toEqual([`${R}2026-10-27-kickoff.md`]);
  });

  it("cuenta mis entregas de hoy y avisa si hay algo atrasado", () => {
    const a = agenda(i, "cami", ahora);
    expect(a.entregas.map((e) => e.ruta)).toEqual([`${E}2026-10-20-dms.md`, `${E}2026-10-27-post.md`]);
    expect(a.pendientes).toBe(2);
    expect(a.atrasado).toBe(true);
    expect(agenda(i, "jorge", ahora).atrasado).toBe(false);
  });

  it("la reunión que empezó hace menos de 10 min sigue como próxima, con 'Ahora'", () => {
    const empezada = new Date("2026-10-27T17:04-03:00");
    const a = agenda(i, "cami", empezada);
    expect(a.proxima?.ruta).toBe(`${R}2026-10-27-revision-mensual-brief.md`);
    expect(cuentaRegresiva(a.proxima!.fecha, empezada)).toBe("Ahora");
    expect(a.masTarde.map((r) => r.ruta)).toEqual([`${R}2026-10-27-kickoff.md`]);
    expect(agenda(i, "cami", new Date("2026-10-27T17:10-03:00")).proxima?.ruta).toBe(`${R}2026-10-27-kickoff.md`);
  });

  it("cuentaRegresiva: 1 minuto, ahora y más de una hora", () => {
    expect(cuentaRegresiva("2026-10-27T16:53-03:00", ahora)).toBe("En 1 minuto");
    expect(cuentaRegresiva("2026-10-27T16:50-03:00", ahora)).toBe("Ahora");
    expect(cuentaRegresiva("2026-10-27T18:30-03:00", ahora)).toBe("A las 18:30");
  });
});

describe("avisosPendientes", () => {
  const ids = (ya: string[] = [], bandejas: string[] = []) =>
    avisosPendientes(i, "cami", ahora, new Set(ya), bandejas).map((a) => a.id);

  it("avisa la reunión que empieza en ≤ 10 minutos y el acta donde soy asistente", () => {
    expect(ids()).toEqual([`reunion:${R}2026-10-27-revision-mensual-brief.md`, `acta:${ACTA}.md`]);
  });

  it("no repite ids ya avisados", () => {
    expect(ids([`reunion:${R}2026-10-27-revision-mensual-brief.md`, `acta:${ACTA}.md`])).toEqual([]);
  });

  it("acta nueva de otra persona sin mí en asistentes → sin aviso", () => {
    expect(ids().some((id) => id.includes("sin-mi"))).toBe(false);
  });

  it("el acta cuenta sus tareas nuevas y cuántas son mías", () => {
    const acta = avisosPendientes(i, "cami", ahora, new Set()).find((a) => a.id.startsWith("acta:"))!;
    expect(acta.titulo).toBe("Acta lista: Revision mensual · Donna's");
    expect(acta.texto).toBe("2 tareas nuevas (1 para ti). Revísalas.");
  });

  it("la bandeja de hoy de la persona da el resumen del día", () => {
    const dia = avisosPendientes(i, "cami", ahora, new Set(), ["bandeja/2026-10-27-hoy-cami.md", "bandeja/2026-10-27-hoy-jorge.md"])
      .filter((a) => a.id.startsWith("dia:"));
    expect(dia).toEqual([{ id: "dia:2026-10-27", titulo: "Tu día: 2 entregas, 4 reuniones", texto: "Tu resumen de hoy está listo.", ruta: "bandeja/2026-10-27-hoy-cami.md" }]);
  });
});

describe("siguienteEstado", () => {
  it("brief → en_curso → revision → aprobado; nunca a publicado", () => {
    expect(siguienteEstado({ estado: "brief" })).toBe("en_curso");
    expect(siguienteEstado({ estado: "en_curso" })).toBe("revision");
    expect(siguienteEstado({ estado: "revision" })).toBe("aprobado");
    expect(siguienteEstado({ estado: "aprobado" })).toBe("aprobado");
    expect(siguienteEstado({ estado: "publicado" })).toBe("publicado");
  });
});
