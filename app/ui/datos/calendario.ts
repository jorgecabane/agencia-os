import { aplicar, type Filtro } from "./filtros";
import { diaDe, fechaLocal } from "./hoy";
import type { Indice } from "./indice";
import type { Entregable, Reunion } from "./tipos";

export type Item = Entregable | Reunion;
export type Dia = { dia: string; items: Item[] };

const DIA_MS = 86_400_000;
const aMs = (dia: string) => Date.parse(`${dia}T00:00:00Z`);
const aDia = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `dia` + `n` días (YYYY-MM-DD; sin zonas horarias de por medio). */
export const sumarDias = (dia: string, n: number): string => aDia(aMs(dia) + n * DIA_MS);
/** Lunes de la semana de `dia`. */
export const lunes = (dia: string): string => sumarDias(dia, -((new Date(aMs(dia)).getUTCDay() + 6) % 7));
/** "2026-10" + `n` meses. */
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return aDia(d.getTime()).slice(0, 7);
}

export const esReunion = (x: Item): x is Reunion => "fecha" in x;
const diaItem = (x: Item) => diaDe(String(esReunion(x) ? x.fecha : x.vence));

/** Reuniones que pasan el filtro: solo cuentan cliente y persona (asistentes); lo demás es de entregables. */
function reunionesFiltradas(rs: Reunion[], f: Filtro): Reunion[] {
  return rs.filter((r) => (!f.clientes?.length || f.clientes.includes(r.cliente))
    && (!f.personas?.length || (r.asistentes ?? []).some((p) => f.personas!.includes(p))));
}

/** Días de `desde` a `hasta` (inclusive) con sus reuniones (por hora) y luego sus entregables. */
export function dias(i: Indice, desde: string, hasta: string, f: Filtro, hoy = fechaLocal()): Dia[] {
  const items = [
    ...reunionesFiltradas(i.reuniones, f).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    ...aplicar(i.entregables, f, hoy),
  ];
  const salida: Dia[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) salida.push({ dia: d, items: items.filter((x) => diaItem(x) === d) });
  return salida;
}

/** El mes "YYYY-MM" en semanas de lunes a domingo (incluye los días de los meses vecinos que completan la grilla). */
export function semanas(i: Indice, mes: string, f: Filtro, hoy = fechaLocal()): Dia[][] {
  const desde = lunes(`${mes}-01`);
  const hasta = sumarDias(lunes(sumarDias(`${sumarMeses(mes, 1)}-01`, -1)), 6);
  const todos = dias(i, desde, hasta, f, hoy);
  return Array.from({ length: todos.length / 7 }, (_, k) => todos.slice(k * 7, k * 7 + 7));
}
