import { expect, it } from "vitest";
import { skills } from "../ui/datos/skills";

const md = (name: string, description: string) => `---\nname: ${name}\ndescription: "${description}"\n---\n# ${name}\n`;

it("activas de .claude/skills y la biblioteca inactiva, con nombre y descripción del frontmatter", () => {
  const s = skills({
    ".claude/skills/ig-carousel/SKILL.md": md("ig-carousel", "Carruseles de Instagram"),
    "biblioteca/skills/marketingskills/pricing/SKILL.md": md("pricing", "Precios y planes"),
    "biblioteca/skills/otros/ig-carousel/SKILL.md": md("ig-carousel", "Copia vieja"),
  });
  expect(s).toEqual([
    { nombre: "ig-carousel", descripcion: "Carruseles de Instagram", activa: true, ruta: ".claude/skills/ig-carousel" },
    { nombre: "pricing", descripcion: "Precios y planes", activa: false, ruta: "biblioteca/skills/marketingskills/pricing" },
  ]);
});

it("sin frontmatter usa el nombre de la carpeta", () => {
  expect(skills({ ".claude/skills/suelta/SKILL.md": "# Hola\n" })[0]).toMatchObject({ nombre: "suelta", descripcion: "" });
});
