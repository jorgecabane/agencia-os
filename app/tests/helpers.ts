import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Crea un repo temporal con los archivos dados (ruta relativa → contenido) y devuelve su ruta. */
export function fixtureRepo(files: Record<string, string>): string {
  const repo = mkdtempSync(join(tmpdir(), "aos-"));
  for (const [ruta, contenido] of Object.entries(files)) {
    const destino = join(repo, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return repo;
}
