import { separar } from "./md";

export type Skill = { nombre: string; descripcion: string; activa: boolean; ruta: string };

export const ACTIVAS = ".claude/skills";
const GLOBS = [`${ACTIVAS}/*/SKILL.md`, "biblioteca/skills/**/SKILL.md"];
const carpetaDe = (ruta: string) => ruta.replace(/\/SKILL\.md$/, "");
const nombreCarpeta = (carpeta: string) => carpeta.split("/").pop() ?? carpeta;

/**
 * Skills activas (`.claude/skills/*`) y de la biblioteca, con nombre y descripción del frontmatter.
 * `ruta` es la carpeta. Las de la biblioteca que ya están activas (misma carpeta) no se repiten.
 */
export function skills(archivos: Record<string, string>): Skill[] {
  const todas = Object.entries(archivos).map(([ruta, texto]): Skill => {
    const meta = separar(texto).meta ?? {};
    const carpeta = carpetaDe(ruta);
    return {
      nombre: typeof meta.name === "string" ? meta.name : nombreCarpeta(carpeta),
      descripcion: typeof meta.description === "string" ? meta.description : "",
      activa: carpeta.startsWith(`${ACTIVAS}/`),
      ruta: carpeta,
    };
  });
  const activas = new Set(todas.filter((s) => s.activa).map((s) => nombreCarpeta(s.ruta)));
  return todas
    .filter((s) => s.activa || !activas.has(nombreCarpeta(s.ruta)))
    .sort((a, b) => Number(b.activa) - Number(a.activa) || a.nombre.localeCompare(b.nombre));
}

export async function leerSkills(): Promise<Skill[]> {
  const rutas = (await Promise.all(GLOBS.map((g) => window.aos.repo.list(g)))).flat();
  const textos = await Promise.all(rutas.map((r) => window.aos.repo.read(r).catch(() => "")));
  return skills(Object.fromEntries(rutas.map((r, k) => [r, textos[k]])));
}

/** Activar = mover la carpeta de la biblioteca a `.claude/skills/<carpeta>`. */
export const activar = (s: Skill): Promise<void> => window.aos.repo.move(s.ruta, `${ACTIVAS}/${nombreCarpeta(s.ruta)}`);
