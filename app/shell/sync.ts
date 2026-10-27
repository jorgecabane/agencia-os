import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Estado } from "../shared/puente";
import { yo } from "./git";

const CALMA_MS = 5_000;
const INTERVALO_MS = 45_000;
const SALIDA_CONFLICTO = 3;
const SALIDA_SIN_CONEXION = 4;
const TIEMPO_MAX_MS = 60_000;

export interface Sync {
  estado(): Estado;
  onEstado(cb: (e: Estado) => void): () => void;
  escribio(): void;
  foco(): void;
  /** Corre ya, incluso tras un conflicto. */
  ahora(): Promise<void>;
  pausar(): () => void;
  /** Resuelve cuando no hay ninguna ejecución en curso (usar tras `pausar()`). */
  enCurso(): Promise<void>;
  parar(): void;
}

export function crearSync(deps: {
  correr: (mensaje: string) => Promise<number>;
  ahora: () => Date;
  persona: () => string | Promise<string>;
}): Sync {
  let estado: Estado = "al-dia";
  let corriendo: Promise<void> | null = null;
  let repetir = false;
  let pausas = 0;
  let calma: NodeJS.Timeout | undefined;
  const oyentes = new Set<(e: Estado) => void>();

  const poner = (e: Estado) => {
    if (e === estado) return;
    estado = e;
    oyentes.forEach((cb) => cb(e));
  };

  async function ejecutar(): Promise<void> {
    poner("subiendo");
    const codigo = await Promise.resolve()
      .then(async () => deps.correr(`app: ${await deps.persona()} ${deps.ahora().toISOString().slice(0, 16)}Z`))
      .catch(() => SALIDA_SIN_CONEXION);
    if (codigo === 0) poner("al-dia");
    else poner(codigo === SALIDA_CONFLICTO ? "conflicto" : "sin-conexion");
  }

  // Una ejecución a la vez; si piden otra mientras corre, se hace una más al terminar.
  function lanzar(): Promise<void> {
    if (corriendo) {
      repetir = true;
      return corriendo;
    }
    corriendo = ejecutar().finally(() => {
      corriendo = null;
      if (repetir) {
        repetir = false;
        auto();
      }
    });
    return corriendo;
  }

  function auto(): void {
    if (pausas > 0 || estado === "conflicto") return;
    void lanzar();
  }

  const intervalo = setInterval(auto, INTERVALO_MS);

  return {
    estado: () => estado,
    onEstado(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    escribio() {
      clearTimeout(calma);
      calma = setTimeout(auto, CALMA_MS);
    },
    foco: auto,
    ahora() {
      if (estado === "conflicto") estado = "sin-conexion"; // salir del bloqueo antes de reintentar
      return lanzar();
    },
    pausar() {
      pausas++;
      let activa = true;
      return () => {
        if (!activa) return;
        activa = false;
        if (--pausas === 0) auto();
      };
    },
    async enCurso() {
      while (corriendo) await corriendo;
    },
    parar() {
      clearInterval(intervalo);
      clearTimeout(calma);
    },
  };
}

/** Pausas de sync por dueño (ventana): al recargar o cerrar, `soltar` libera las que quedaron colgadas. */
export function crearPausas(sync: Pick<Sync, "pausar">) {
  const porDueno = new Map<number, Map<number, () => void>>();
  return {
    pausar(dueno: number, id: number) {
      if (!porDueno.has(dueno)) porDueno.set(dueno, new Map());
      porDueno.get(dueno)!.set(id, sync.pausar());
    },
    reanudar(dueno: number, id: number) {
      porDueno.get(dueno)?.get(id)?.();
      porDueno.get(dueno)?.delete(id);
    },
    soltar(dueno: number) {
      porDueno.get(dueno)?.forEach((r) => r());
      porDueno.delete(dueno);
    },
  };
}

/** Corre `.claude/hooks/sync.sh` y devuelve su código de salida (0, 3 o 4). */
export function correrSyncSh(raiz: string): (mensaje: string) => Promise<number> {
  return (mensaje) =>
    new Promise((resolver) => {
      execFile(
        join(raiz, ".claude/hooks/sync.sh"),
        [mensaje],
        { env: { ...process.env, CLAUDE_PROJECT_DIR: raiz }, timeout: TIEMPO_MAX_MS },
        (err) => resolver(err ? (typeof err.code === "number" ? err.code : SALIDA_SIN_CONEXION) : 0),
      );
    });
}

const AJUSTES = ".claude/settings.local.json";
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Lee `.claude/settings.local.json`; `{}` si no existe. Lanza si existe pero está roto (no hay que pisarlo). */
function leerAjustes(raiz: string): Record<string, unknown> {
  let texto: string;
  try {
    texto = readFileSync(join(raiz, AJUSTES), "utf8");
  } catch {
    return {};
  }
  return JSON.parse(texto);
}

/** `env.AOS_PERSONA` de `.claude/settings.local.json`, o null si no hay. */
export function personaGuardada(raiz: string): string | null {
  try {
    const env = leerAjustes(raiz).env as Record<string, unknown> | undefined;
    return env?.AOS_PERSONA ? String(env.AOS_PERSONA) : null;
  } catch {
    return null;
  }
}

/** Escribe `env.AOS_PERSONA` conservando el resto del archivo. */
export function guardarPersona(raiz: string, slug: string): void {
  if (!SLUG.test(slug)) throw new Error("persona inválida");
  const ajustes = leerAjustes(raiz);
  const env = { ...(ajustes.env as Record<string, unknown> | undefined), AOS_PERSONA: slug };
  const ruta = join(raiz, AJUSTES);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(`${ruta}.tmp`, `${JSON.stringify({ ...ajustes, env }, null, 2)}\n`);
  renameSync(`${ruta}.tmp`, ruta);
}

/** Persona de `.claude/settings.local.json` (env.AOS_PERSONA); si falta, `git config user.name`. */
export async function leerPersona(raiz: string): Promise<string> {
  return personaGuardada(raiz) ?? ((await yo(raiz)).nombre || "sin-nombre");
}
