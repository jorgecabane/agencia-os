import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Commit } from "../shared/puente";

const exec = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const REGISTRO = "\x1e";
const CAMPO = "\x1f";

export async function git(raiz: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", raiz, ...args], { maxBuffer: MAX_BUFFER });
  return stdout;
}

export async function yo(raiz: string): Promise<{ nombre: string; email: string }> {
  const leer = (k: string) => git(raiz, "config", k).then((s) => s.trim(), () => "");
  return { nombre: await leer("user.name"), email: await leer("user.email") };
}

export async function log(
  raiz: string,
  { desde, ruta, max }: { desde?: string; ruta?: string; max?: number } = {},
): Promise<Commit[]> {
  const args = ["log", "--name-only", `--format=${REGISTRO}%H${CAMPO}%an${CAMPO}%ae${CAMPO}%aI${CAMPO}%s${CAMPO}`];
  if (max) args.push(`-n${Math.floor(max)}`);
  args.push(desde ? `${desde}..HEAD` : "HEAD", "--");
  if (ruta) args.push(ruta);
  const salida = await git(raiz, ...args);
  return salida
    .split(REGISTRO)
    .filter(Boolean)
    .map((bloque) => {
      const [hash, autor, email, fecha, mensaje, resto] = bloque.split(CAMPO);
      return { hash, autor, email, fecha, mensaje, rutas: resto.split("\n").filter(Boolean) };
    });
}

/** Contenido de `ruta` tal como quedó en el commit `hash`. */
export function show(raiz: string, hash: string, ruta: string): Promise<string> {
  if (!/^[0-9a-f]{4,40}$/.test(hash)) throw new Error("commit inválido");
  return git(raiz, "show", `${hash}:${ruta}`);
}
