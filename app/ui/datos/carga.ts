import { aplicar } from "./filtros";
import type { Indice } from "./indice";

export const LIMITE_ALTA = 8;
export type Carga = { slug: string; nombre: string; porEstado: Record<string, number>; atrasadas: number; total: number; alta: boolean };

/** Tareas abiertas de cada persona (y de Claude) esta semana más las atrasadas; la más cargada primero. */
export function carga(i: Indice, hoy: string): Carga[] {
  const atrasadas = aplicar(i.entregables, { vence: "atrasado" }, hoy);
  const semana = aplicar(i.entregables, { vence: "semana" }, hoy).filter((e) => e.estado !== "publicado");
  const abiertas = [...new Set([...semana, ...atrasadas])];
  const gente = [...i.personas.map((p) => ({ slug: p.slug, nombre: p.nombre })), { slug: "ia", nombre: "Claude" }];
  return gente.map(({ slug, nombre }) => {
    const suyas = abiertas.filter((e) => e.responsable === slug);
    const porEstado: Record<string, number> = {};
    for (const e of suyas) porEstado[e.estado] = (porEstado[e.estado] ?? 0) + 1;
    const total = suyas.length;
    return { slug, nombre, porEstado, total, atrasadas: atrasadas.filter((e) => e.responsable === slug).length, alta: total >= LIMITE_ALTA };
  }).sort((a, b) => b.total - a.total);
}
