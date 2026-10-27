import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface UIElegida {
  origen: "repo" | "empaquetada";
  ruta: string;
  aviso?: string;
}

/** UI que viene dentro del .app (compilado a out/shell/, ui-dist queda dos niveles arriba). */
const UI_EMPAQUETADA = join(__dirname, "..", "..", "ui-dist", "index.html");
const AVISO_MARCO_VIEJO = "Actualiza el marco para ver la última versión";

function leerMinShell(manifest: string): number | null {
  try {
    const { minShell } = JSON.parse(readFileSync(manifest, "utf8"));
    return typeof minShell === "number" ? minShell : null;
  } catch {
    return null;
  }
}

export function elegirUI(repo: string | null, shellVersion: number): UIElegida {
  const empaquetada: UIElegida = { origen: "empaquetada", ruta: UI_EMPAQUETADA };
  if (!repo) return empaquetada;
  const dist = join(repo, "app", "ui-dist");
  const index = join(dist, "index.html");
  const minShell = leerMinShell(join(dist, "manifest.json"));
  if (!existsSync(index) || minShell === null) return empaquetada;
  if (minShell > shellVersion) return { ...empaquetada, aviso: AVISO_MARCO_VIEJO };
  return { origen: "repo", ruta: index };
}
