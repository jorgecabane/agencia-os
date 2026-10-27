import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/** Persona de `.claude/settings.local.json` (env.AOS_PERSONA); si falta, `git config user.name`. */
export async function leerPersona(raiz: string): Promise<string> {
  try {
    const cfg = JSON.parse(readFileSync(join(raiz, ".claude/settings.local.json"), "utf8"));
    if (cfg?.env?.AOS_PERSONA) return String(cfg.env.AOS_PERSONA);
  } catch {
    // sin archivo o inválido: se usa git
  }
  return (await yo(raiz)).nombre || "sin-nombre";
}
