import { describe, expect, it } from "vitest";
import { agregarCasilla, alternarCasilla, checklist } from "../ui/datos/checklist";
import { agregarComentario, comentarios, menciones } from "../ui/datos/comentarios";
import { CATALOGO, colorEtiqueta, guardarEtiqueta, leerCatalogo, nuevaEtiqueta } from "../ui/datos/etiquetas";
import { aplicar } from "../ui/datos/filtros";
import { construirIndice } from "../ui/datos/indice";
import { separar } from "../ui/datos/md";
import { archivoNueva, crearTarea, interpretar, rutaNueva, type NuevaTarea } from "../ui/datos/nueva";
import type { Entregable, Persona } from "../ui/datos/tipos";

const personas = [
  { ruta: "a", nombre: "Cami Pérez", slug: "cami", rol: "x", nivel_automatizacion: "alto" },
  { ruta: "b", nombre: "Jorge Cabané", slug: "jorge", rol: "x", nivel_automatizacion: "alto" },
] as Persona[];
const nueva = (o: Partial<NuevaTarea> = {}): NuevaTarea =>
  ({ titulo: "Guion reel", cliente: "donnas", responsable: "cami", vence: "2026-11-02", estado: "brief", etiquetas: [], ...o });

describe("etiquetas", () => {
  it("leerCatalogo lee el frontmatter y devuelve [] si está roto", () => {
    const t = "---\netiquetas:\n  - {slug: a, nombre: A, color: 1}\n  - {slug: b, nombre: B, color: 2}\n---\n";
    expect(leerCatalogo(t)).toHaveLength(2);
    expect(leerCatalogo("---\netiquetas: [sin cerrar\n---\n")).toEqual([]);
    expect(leerCatalogo("---\netiquetas:\n  - {slug: a, nombre: A, color: 9}\n---\n")).toEqual([]);
  });
  it("nuevaEtiqueta cicla el color y reutiliza la existente", () => {
    const cat = [{ slug: "a", nombre: "A", color: 6 }];
    expect(nuevaEtiqueta(cat, "Campaña Navidad")).toEqual({ slug: "campana-navidad", nombre: "Campaña Navidad", color: 1 });
    expect(nuevaEtiqueta(cat, "a")).toBe(cat[0]);
    expect(nuevaEtiqueta([], "X")?.color).toBe(1);
    expect(colorEtiqueta(cat[0])).toBe("var(--cliente-6)");
  });
});

describe("comentarios", () => {
  it("solo lee la sección Comentarios", () => {
    const c = "## Brief\n\n- otra lista\n\n## Comentarios\n\n- 2026-10-27T21:06Z · jorge: uno\n- 2026-10-27T21:07Z · cami: dos\n";
    expect(comentarios(c).map((x) => x.texto)).toEqual(["uno", "dos"]);
  });
  it("agregarComentario crea la sección y aplana saltos de línea", () => {
    const r = agregarComentario("hola\nmundo", { fecha: "2026-10-27T21:06Z", autor: "jorge", texto: "hola\nmundo" });
    expect(r.endsWith("## Comentarios\n\n- 2026-10-27T21:06Z · jorge: hola mundo")).toBe(true);
    expect(comentarios(r)).toEqual([{ fecha: "2026-10-27T21:06Z", autor: "jorge", texto: "hola mundo" }]);
  });
  it("agrega al final de una sección existente", () => {
    const r = agregarComentario("## Comentarios\n\n- 2026-10-27T21:06Z · a: x\n\n## Otra\n", { fecha: "f", autor: "b", texto: "y" });
    expect(comentarios(r).map((x) => x.texto)).toEqual(["x", "y"]);
  });
  it("separa solo el primer ' · ' y el primer ': '", () => {
    const r = agregarComentario("", { fecha: "2026-10-27T21:06Z", autor: "jorge", texto: "a · b" });
    expect(comentarios(r)[0].texto).toBe("a · b");
    expect(comentarios(agregarComentario("", { fecha: "f", autor: "j", texto: "x: y" }))[0].texto).toBe("x: y");
  });
  it("menciones por primer nombre o slug, sin tildes ni mayúsculas", () => {
    expect(menciones("ok @Cami y @jorge", personas)).toEqual(["cami", "jorge"]);
    expect(menciones("@Camila", personas)).toEqual([]);
    expect(menciones("@CAMI hola", personas)).toEqual(["cami"]);
  });
});

describe("checklist", () => {
  const cuerpo = "## Promesas\n\n- [ ] x\n\n## Checklist\n\n- [x] Copy\n- [ ] OK de Paula\n";
  it("lee solo la sección y alterna sin tocar lo demás", () => {
    expect(checklist(cuerpo).map((c) => [c.texto, c.hecho])).toEqual([["Copy", true], ["OK de Paula", false]]);
    const r = alternarCasilla(cuerpo, checklist(cuerpo)[1].linea);
    expect(checklist(r)[1].hecho).toBe(true);
    expect(r).toContain("## Promesas\n\n- [ ] x");
  });
  it("agregarCasilla", () => {
    expect(checklist(agregarCasilla(cuerpo, "Nueva")).map((c) => c.texto)).toEqual(["Copy", "OK de Paula", "Nueva"]);
    expect(checklist(agregarCasilla("hola", "Una"))).toHaveLength(1);
  });
});

describe("tarea nueva", () => {
  const indice = construirIndice(new Map([
    ["equipo/personas/cami.md", "---\ntipo: persona\nnombre: Cami Pérez\nslug: cami\nrol: x\nnivel_automatizacion: alto\n---\n"],
    ["clientes/donnas/_ficha.md", "---\ntipo: cliente\nnombre: Donna's\nslug: donnas\netapa: activo\nmodalidad: retainer\nresponsable: cami\n---\n"],
  ]));
  it("interpretar saca @persona y #cliente del título", () => {
    expect(interpretar("Guion reel @cami #donnas", indice)).toEqual({ titulo: "Guion reel", responsable: "cami", cliente: "donnas" });
    expect(interpretar("Revisar @claude", indice).responsable).toBe("ia");
    expect(interpretar("Post #1 @nadie", indice)).toEqual({ titulo: "Post #1 @nadie", cliente: undefined, responsable: undefined });
  });
  it("nuevaEtiqueta rechaza nombres sin letras ni números", () => {
    expect(nuevaEtiqueta([], "🎉!!")).toBeNull();
  });
  it("rutaNueva usa 'tarea' si el título no deja slug", () => {
    expect(rutaNueva(nueva({ titulo: "🎉!!" }), new Set())).toBe("clientes/donnas/entregables/2026-11-02-tarea.md");
  });
  it("rutaNueva evita choques", () => {
    const base = "clientes/donnas/entregables/2026-11-02-guion-reel.md";
    expect(rutaNueva(nueva(), new Set())).toBe(base);
    expect(rutaNueva(nueva(), new Set([base]))).toMatch(/-2\.md$/);
    expect(rutaNueva(nueva(), new Set([base, base.replace(".md", "-2.md")]))).toMatch(/-3\.md$/);
  });
  it("archivoNueva produce frontmatter válido", () => {
    const t = nueva({ titulo: 'Post: "5 cosas" #1' });
    const { meta, error } = separar(archivoNueva(t));
    expect(error).toBeUndefined();
    expect(meta?.titulo).toBe(t.titulo);
    expect(meta?.formato).toBe("tarea");
    expect(meta && "etiquetas" in meta).toBe(false);
    expect(separar(archivoNueva(nueva({ etiquetas: ["a"] }))).meta?.etiquetas).toEqual(["a"]);
  });
});

describe("integración con filtros e índice", () => {
  it("aplicar filtra por alguna etiqueta", () => {
    const e = (r: string, etiquetas?: string[]) =>
      ({ ruta: r, cliente: "c", formato: "f", vence: "2026-11-01", estado: "brief", responsable: "x", etiquetas }) as Entregable;
    const es = [e("1", ["navidad", "otra"]), e("2", ["otra"]), e("3")];
    expect(aplicar(es, { etiquetas: ["navidad"] }, "2026-11-01").map((x) => x.ruta)).toEqual(["1"]);
  });
  it("el catálogo llena indice.etiquetas y no es un archivo roto", () => {
    const i = construirIndice(new Map([["equipo/etiquetas.md", "---\netiquetas:\n  - {slug: a, nombre: A, color: 1}\n  - {slug: b, nombre: B, color: 2}\n---\n"]]));
    expect(i.etiquetas).toHaveLength(2);
    expect(i.rotos).toEqual([]);
  });
  it("los entregables guardan sus comentarios", () => {
    const i = construirIndice(new Map([["clientes/c/entregables/x.md",
      "---\ntipo: entregable\ncliente: c\nformato: f\nvence: 2026-11-01\nestado: brief\nresponsable: x\n---\n## Comentarios\n\n- 2026-10-27T21:06Z · a: hola\n"]]));
    expect(i.entregables[0].comentarios).toHaveLength(1);
  });
});

describe("correcciones de seguridad de datos", () => {
  const usarRepo = (archivos: Record<string, string>) => {
    const escritos: Record<string, string> = {};
    (globalThis as { window?: unknown }).window = { aos: { repo: {
      list: async (g: string) => Object.keys(archivos).filter((r) => r === g),
      read: async (r: string) => { if (r in archivos) return archivos[r]; throw new Error("no existe"); },
      write: async (r: string, c: string) => void (escritos[r] = c),
    } } };
    return escritos;
  };
  it("alternarCasilla ignora índices fuera de ## Checklist", () => {
    const c = "## Promesas\n\n- [ ] x\n\n## Checklist\n\n- [ ] y\n";
    expect(alternarCasilla(c, 2)).toBe(c);
  });
  it("guardarEtiqueta no pisa un catálogo con contenido que no se puede leer", async () => {
    const escritos = usarRepo({ [CATALOGO]: "---\netiquetas:\n  - {slug: a, nombre: A, color: 9}\n---\n" });
    await expect(guardarEtiqueta({ slug: "b", nombre: "B", color: 1 })).rejects.toThrow();
    expect(escritos).toEqual({});
  });
  it("guardarEtiqueta crea el catálogo si no existe", async () => {
    const escritos = usarRepo({});
    await guardarEtiqueta({ slug: "b", nombre: "B", color: 1 });
    expect(leerCatalogo(escritos[CATALOGO])).toHaveLength(1);
  });
  it("crearTarea no pisa un archivo que ya existe en el repo", async () => {
    const base = "clientes/donnas/entregables/2026-11-02-guion-reel.md";
    const escritos = usarRepo({ [base]: "sync" });
    expect(await crearTarea(nueva(), "cami", new Set())).toBe(base.replace(".md", "-2.md"));
    expect(Object.keys(escritos)).toEqual([base.replace(".md", "-2.md")]);
  });
});
