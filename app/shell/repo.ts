import fg from "fast-glob";
import { statSync, watch } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const IGNORADOS = [".git", "node_modules", "ui-dist"];
const MARCA_TMP = ".aos-tmp";
export const ESPERA_CAMBIOS_MS = 150;

// macOS a veces reporta la propia carpeta del repo (por su nombre); los cambios de carpetas son ruido.
const esRuido = (base: string, ruta: string) => {
  try {
    return statSync(join(base, ruta)).isDirectory();
  } catch {
    return ruta === basename(base);
  }
};

const ignorada = (ruta: string) =>
  ruta.endsWith(MARCA_TMP) || ruta.split(sep).some((parte) => IGNORADOS.includes(parte));

/** Operaciones sobre los archivos del repo. Puro Node: el cableado a Electron vive en main.ts. */
export function crearRepo(raiz: string) {
  const base = resolve(raiz);
  const abs = (ruta: string): string => {
    const destino = resolve(base, ruta);
    const rel = relative(base, destino);
    if (isAbsolute(ruta) || !rel || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("ruta fuera del repo");
    return destino;
  };
  // Escribir, mover o borrar nunca toca .git.
  const absEscritura = (ruta: string): string => {
    const destino = abs(ruta);
    if (relative(base, destino).split(sep)[0] === ".git") throw new Error("ruta fuera del repo");
    return destino;
  };

  const escribir = async (ruta: string, contenido: string | Buffer): Promise<void> => {
    const destino = absEscritura(ruta);
    await mkdir(dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.${randomUUID()}${MARCA_TMP}`;
    try {
      await writeFile(tmp, contenido);
      await rename(tmp, destino);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  };

  return {
    async list(patron: string): Promise<string[]> {
      abs(patron.replace(/\*/g, "x"));
      return fg(patron, { cwd: base, ignore: IGNORADOS.map((d) => `**/${d}/**`), dot: true });
    },
    async read(ruta: string): Promise<string> {
      return readFile(abs(ruta), "utf8");
    },
    write(ruta: string, contenido: string): Promise<void> {
      return escribir(ruta, contenido);
    },
    /** Para binarios (imágenes): mismo resguardo y escritura atómica que `write`. */
    writeBase64(ruta: string, base64: string): Promise<void> {
      return escribir(ruta, Buffer.from(base64, "base64"));
    },
    async move(de: string, a: string): Promise<void> {
      const destino = absEscritura(a);
      const origen = absEscritura(de);
      await mkdir(dirname(destino), { recursive: true });
      await rename(origen, destino);
    },
    async delete(ruta: string): Promise<void> {
      await rm(absEscritura(ruta), { recursive: true });
    },
    /** Avisa de los archivos cambiados, agrupados cada 150 ms. Devuelve cómo dejar de vigilar. */
    onCambio(cb: (rutas: string[]) => void): () => void {
      const juntas = new Set<string>();
      let timer: NodeJS.Timeout | undefined;
      const vigia = watch(base, { recursive: true }, (_evento, nombre) => {
        const ruta = nombre ? join(nombre.toString()) : "";
        if (!ruta || ignorada(ruta) || esRuido(base, ruta)) return;
        juntas.add(ruta.split(sep).join("/"));
        timer ??= setTimeout(() => {
          const rutas = [...juntas].sort();
          juntas.clear();
          timer = undefined;
          cb(rutas);
        }, ESPERA_CAMBIOS_MS);
      });
      vigia.on("error", () => vigia.close());
      return () => {
        clearTimeout(timer);
        vigia.close();
      };
    },
  };
}

export type Repo = ReturnType<typeof crearRepo>;
