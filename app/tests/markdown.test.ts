import { describe, expect, it } from "vitest";
import { componer, modoInicial, relativa, rutaAdjunto, serializar } from "../ui/datos/markdown";

const TABLA = "| Segmento | Qué le importa | Dónde está |\n| --- | --- | --- |\n| Adoptantes | Qué comprar | Instagram |";
const CUERPO = `# Contexto

[[clientes/acme/_ficha]] y [[clientes/acme/plan-contratado]].

- [ ] jorge: algo (2026-10-30)
- [x] cami: listo

${TABLA}
`;

describe("serializar", () => {
  it("conserva wikilinks, tareas y tablas de 3 columnas", () => {
    const out = serializar(CUERPO);
    expect(out).toContain("[[clientes/acme/_ficha]]");
    expect(out).toContain("[[clientes/acme/plan-contratado]]");
    expect(out).toContain("- [ ] jorge: algo (2026-10-30)");
    expect(out).toContain("- [x] cami: listo");
    expect(out).toMatch(/\| Segmento +\| Qué le importa +\| Dónde está +\|/);
    expect(out).toMatch(/\| Adoptantes +\| Qué comprar +\| Instagram +\|/);
    expect(serializar(out)).toBe(out);
  });

  it("deshace los escapes que mete el editor y usa guiones en listas", () => {
    const delEditor = "Ver \\[\\[clientes/acme/\\_ficha]].\n\n* [ ] jorge: algo (2026-10-30)\n* uno\n";
    expect(serializar(delEditor)).toBe("Ver [[clientes/acme/_ficha]].\n\n- [ ] jorge: algo (2026-10-30)\n- uno\n");
  });
});

describe("componer", () => {
  const ARCHIVO = `---\ntipo: entregable\nestado: brief   # ojo\n---\n${CUERPO}`;

  it("sin cambios devuelve el archivo tal cual, aunque el editor normalice el formato", () => {
    const normalizado = CUERPO.replaceAll("- [", "* [").replace("[[clientes/acme/_ficha]]", "\\[\\[clientes/acme/\\_ficha]]");
    expect(componer(ARCHIVO, {}, normalizado)).toBe(ARCHIVO);
    expect(componer(ARCHIVO, {}, CUERPO)).toBe(ARCHIVO);
  });

  it("al editar un párrafo conserva el frontmatter byte a byte y el resto del cuerpo", () => {
    const out = componer(ARCHIVO, {}, CUERPO.replace("[[clientes/acme/_ficha]] y", "Revisa [[clientes/acme/_ficha]] y"));
    expect(out.startsWith("---\ntipo: entregable\nestado: brief   # ojo\n---\n")).toBe(true);
    expect(out).toContain("Revisa [[clientes/acme/_ficha]]");
    expect(out).toContain("- [ ] jorge: algo (2026-10-30)");
  });

  it("cambia solo la clave editada del frontmatter", () => {
    expect(componer(ARCHIVO, { estado: "en_curso" }, CUERPO)).toBe(ARCHIVO.replace("estado: brief", "estado: en_curso"));
  });
});

describe("rutaAdjunto", () => {
  it("guarda en adjuntos del cliente, o en adjuntos de la carpeta de arriba", () => {
    expect(rutaAdjunto("clientes/acme/entregables/x.md", "Foto Casting.PNG", "2026-10-27")).toBe("clientes/acme/adjuntos/2026-10-27-foto-casting.png");
    expect(rutaAdjunto("bandeja/x.md", "Ñandú café.jpg", "2026-10-27")).toBe("bandeja/adjuntos/2026-10-27-nandu-cafe.jpg");
    expect(rutaAdjunto("nota.md", "a.gif", "2026-10-27")).toBe("adjuntos/2026-10-27-a.gif");
    expect(rutaAdjunto("nota.md", "raro.p[n]*g?", "2026-10-27")).toBe("adjuntos/2026-10-27-raro.png");
    expect(rutaAdjunto("nota.md", "sin-extension", "2026-10-27")).toBe("adjuntos/2026-10-27-sin-extension.bin");
    expect(rutaAdjunto("nota.md", "x.[*]", "2026-10-27")).toBe("adjuntos/2026-10-27-x.bin");
  });
});

describe("relativa", () => {
  it("arma el link de la imagen desde la carpeta del archivo", () => {
    expect(relativa("clientes/acme/contexto.md", "clientes/acme/adjuntos/a.png")).toBe("adjuntos/a.png");
    expect(relativa("clientes/acme/entregables/x.md", "clientes/acme/adjuntos/a.png")).toBe("../adjuntos/a.png");
    expect(relativa("nota.md", "adjuntos/a.png")).toBe("adjuntos/a.png");
  });
});

describe("componer en modo markdown y archivo", () => {
  const ARCHIVO = "---\nestado: brief  # x\n---\nTexto *crudo*   con espacios\n";
  it("markdown: el cuerpo va tal cual lo escribí, sin re-serializar; sin cambios no cambia nada", () => {
    expect(componer(ARCHIVO, {}, "Texto *crudo*   con espacios\n", "markdown")).toBe(ARCHIVO);
    expect(componer(ARCHIVO, { estado: "en_curso" }, "Otro   texto\n", "markdown")).toBe("---\nestado: en_curso  # x\n---\nOtro   texto\n");
  });
  it("archivo: el texto es el archivo completo, sin pasar por unir", () => {
    expect(componer("---\nroto: [\n", {}, "---\nroto: [arreglado]\n---\n", "archivo")).toBe("---\nroto: [arreglado]\n---\n");
  });
});

describe("modoInicial", () => {
  it("visual si el editor entiende todo", () => {
    expect(modoInicial(`---\ntipo: x\n---\n${CUERPO}`)).toBe("visual");
    expect(modoInicial("Sin frontmatter, con *énfasis* y `código`.\n")).toBe("visual");
  });
  it("archivo si el frontmatter está roto", () => {
    expect(modoInicial("---\ntipo: x\nsin cerrar\n")).toBe("archivo");
    expect(modoInicial("---\ntipo: [\n---\nhola\n")).toBe("archivo");
  });
  it("markdown si hay partes que el editor visual no representa", () => {
    expect(modoInicial("Hola <span>html</span>\n")).toBe("markdown");
    expect(modoInicial("Nota[^1]\n\n[^1]: al pie\n")).toBe("markdown");
    expect(modoInicial("[link][ref]\n\n[ref]: https://x.cl\n")).toBe("markdown");
  });
});
