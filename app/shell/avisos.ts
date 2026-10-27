import type { Aviso, Config } from "../shared/puente";

const RECORDADOS_MAX = 500; // ids de avisos guardados en config.json; los más viejos ya no vuelven a calzar
const INTERRUPTOR: Record<string, keyof Config["avisos"]> = { reunion: "reuniones", acta: "actas", dia: "dia" };

/** Solo links https (nunca javascript:, file: ni http:). */
export function esHttps(url: unknown): boolean {
  try {
    return new URL(String(url)).protocol === "https:";
  } catch {
    return false;
  }
}

/** Un aviso se muestra si no se mostró antes, su clase está encendida y los avisos no están en pausa. */
export function debeAvisar(c: Pick<Config, "avisos" | "pausaHasta" | "yaAvisados">, id: string, ahora: Date): boolean {
  const interruptor = INTERRUPTOR[id.split(":")[0]];
  if (!interruptor || !c.avisos[interruptor] || c.yaAvisados.includes(id)) return false;
  return !c.pausaHasta || new Date(c.pausaHasta).getTime() <= ahora.getTime();
}

export const recordar = (ya: string[], id: string): string[] => [...ya.filter((x) => x !== id), id].slice(-RECORDADOS_MAX);

/** Lo que manda la UI por IPC: un aviso con sus cuatro textos. */
export const esAviso = (a: unknown): a is Aviso =>
  typeof a === "object" && a !== null && ["id", "titulo", "texto", "ruta"].every((k) => typeof (a as Record<string, unknown>)[k] === "string");
