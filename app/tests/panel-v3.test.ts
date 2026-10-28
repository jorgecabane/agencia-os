import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import type { Commit } from "../shared/puente";
import { debeAvisar } from "../shell/avisos";
import { leerConfig } from "../shell/config";
import { historial } from "../ui/datos/actividad";
import { avisosPendientes } from "../ui/datos/agenda";
import { construirIndice } from "../ui/datos/indice";
import { cambiarCuerpo } from "../ui/datos/md";
import { alternarCasilla } from "../ui/datos/checklist";
import { fixtureRepo } from "./helpers";

const persona = (slug: string, nombre: string) =>
  `---\ntipo: persona\nnombre: ${nombre}\nslug: ${slug}\nrol: x\nnivel_automatizacion: alto\n---\n`;
const RUTA = "clientes/donnas/entregables/2026-10-30-post.md";
const conComentario = (fecha: string, autor: string) => construirIndice(new Map([
  ["equipo/personas/jorge.md", persona("jorge", "Jorge Cabane")],
  ["equipo/personas/cami.md", persona("cami", "Cami")],
  [RUTA, "---\ntipo: entregable\ncliente: donnas\nformato: post\nvence: 2026-10-30\nestado: en_curso\nresponsable: cami\n---\n" +
    `Texto.\n\n## Comentarios\n\n- ${fecha} · ${autor}: @Jorge ¿puedes revisar el copy?\n`],
]));
const ahora = new Date("2026-10-27T21:00Z");
const menciones = (fecha: string, autor: string) =>
  avisosPendientes(conComentario(fecha, autor), "jorge", ahora, new Set()).filter((a) => a.id.startsWith("mencion:"));

describe("historial", () => {
  const c = (fecha: string, mensaje: string, autor = "Cami"): Commit => ({ hash: fecha, autor, email: "", fecha, mensaje, rutas: [] });
  it("el más nuevo primero y sin prefijo app:/ia:", () => {
    const personas = [{ ruta: "x", nombre: "Cami", slug: "cami", rol: "r", nivel_automatizacion: "alto" }];
    const h = historial([c("2026-10-26T10:00Z", "ia: Armó 4 slides", "claude"), c("2026-10-27T08:40Z", "app: Editó el copy", "cami")], personas);
    expect(h).toEqual([
      { quien: "Cami", texto: "editó el copy", fecha: "2026-10-27T08:40Z" },
      { quien: "claude", texto: "armó 4 slides", fecha: "2026-10-26T10:00Z" },
    ]);
  });
});

describe("avisos de mención", () => {
  it("@Jorge de cami hace 1 h → 1 aviso", () => {
    expect(menciones("2026-10-27T20:00Z", "cami")).toEqual([{
      id: `mencion:${RUTA}:2026-10-27T20:00Z`, ruta: RUTA,
      titulo: "Cami te mencionó", texto: "@Jorge ¿puedes revisar el copy?",
    }]);
  });
  it("si lo escribió jorge → 0", () => expect(menciones("2026-10-27T20:00Z", "jorge")).toEqual([]));
  it("de hace 3 días → 0", () => expect(menciones("2026-10-24T20:00Z", "cami")).toEqual([]));
  it("el texto se corta a 120 caracteres", () => {
    const i = conComentario("2026-10-27T20:00Z", "cami");
    i.entregables[0].comentarios![0].texto = `@Jorge ${"x".repeat(200)}`;
    expect(avisosPendientes(i, "jorge", ahora, new Set())[0].texto).toHaveLength(120);
  });
});

describe("interruptor de menciones", () => {
  const base = { avisos: { reuniones: true, actas: true, dia: true, menciones: true }, pausaHasta: null, yaAvisados: [] };
  it("respeta avisos.menciones", () => {
    expect(debeAvisar(base, "mencion:a.md:2026-10-27T20:00Z", ahora)).toBe(true);
    expect(debeAvisar({ ...base, avisos: { ...base.avisos, menciones: false } }, "mencion:a.md:x", ahora)).toBe(false);
  });
  it("un config guardado sin menciones las deja encendidas", () => {
    const ruta = join(fixtureRepo({}), "config.json");
    writeFileSync(ruta, JSON.stringify({ avisos: { reuniones: false, actas: true, dia: true } }));
    expect(leerConfig(ruta).avisos).toEqual({ reuniones: false, actas: true, dia: true, menciones: true });
  });
});

describe("cambiarCuerpo", () => {
  it("relee, cambia el cuerpo y deja el frontmatter byte a byte", async () => {
    const fm = "---\ntipo: entregable\netiquetas: [a,  b]   # ojo\nvence: 2026-10-30\n---\n";
    const archivo = { texto: `${fm}## Checklist\n\n- [ ] Copy\n` };
    (globalThis as { window?: unknown }).window = { aos: { repo: {
      read: async () => archivo.texto, write: async (_: string, c: string) => void (archivo.texto = c),
    } } };
    await cambiarCuerpo("x.md", (c) => alternarCasilla(c, 2));
    expect(archivo.texto).toBe(`${fm}## Checklist\n\n- [x] Copy\n`);
  });
});
