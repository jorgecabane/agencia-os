import { useEffect, useState } from "react";
import type { Commit } from "../../shared/puente";
import type { Persona } from "./tipos";

export type Actividad = { tipo: "avanzo" | "quieta" | "sin-abrir"; texto: string };

const HORA_MS = 3_600_000;
const DIAS_QUIETA = 3;

/** Qué pasó con una tarea según su último commit. El autor se muestra con su nombre de persona si calza. */
export function actividad(ultimo: Commit | undefined, hoy: Date, personas: Persona[] = []): Actividad {
  if (!ultimo) return { tipo: "sin-abrir", texto: "Sin abrir todavía" };
  const horas = Math.max(0, Math.floor((hoy.getTime() - Date.parse(ultimo.fecha)) / HORA_MS));
  const dias = Math.floor(horas / 24);
  if (dias >= DIAS_QUIETA) return { tipo: "quieta", texto: `Quieta hace ${dias} días` };
  return { tipo: "avanzo", texto: `${autor(ultimo, personas)} avanzó ${hace(ultimo.fecha, hoy)}` };
}

/** Nombre de persona del autor del commit si calza (sin mayúsculas); si no, el nombre de git. */
export const autor = (c: Commit, personas: Persona[]): string =>
  personas.find((p) => p.nombre.toLowerCase() === c.autor.toLowerCase())?.nombre ?? c.autor;

/** "recién", "hace 3 h", "ayer" o "hace 5 días". */
export function hace(fecha: string, hoy: Date): string {
  const horas = Math.max(0, Math.floor((hoy.getTime() - Date.parse(fecha)) / HORA_MS));
  const dias = Math.floor(horas / 24);
  return horas < 1 ? "recién" : horas < 24 ? `hace ${horas} h` : dias === 1 ? "ayer" : `hace ${dias} días`;
}

// Último commit por ruta, compartido entre pantallas. undefined = sin commits; null = aún preguntando.
const cache = new Map<string, Commit | undefined | null>();
const oyentes = new Set<() => void>();
const sucios = new Set<string>(); // cambiaron en disco: su commit llega con el próximo sync
const EN_PARALELO = 6;

async function traer(rutas: string[]): Promise<void> {
  const cola = [...rutas];
  const trabajador = async () => {
    for (let r = cola.shift(); r !== undefined; r = cola.shift()) {
      const [c] = await window.aos.git.log({ ruta: r, max: 1 }).catch(() => []);
      cache.set(r, c);
    }
  };
  await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));
  oyentes.forEach((cb) => cb());
}

let escuchando = false;
function escuchar(): void {
  if (escuchando) return;
  escuchando = true;
  window.aos.repo.onCambio((rutas) => {
    const conocidas = rutas.filter((r) => cache.has(r));
    conocidas.forEach((r) => sucios.add(r));
    if (conocidas.length) void traer(conocidas); // un pull ya trae el commit
  });
  window.aos.sync.onEstado((e) => {
    if (e !== "al-dia" || !sucios.size) return;
    const rutas = [...sucios];
    sucios.clear();
    void traer(rutas); // lo escrito aquí queda commiteado al terminar el sync
  });
}

/** Último commit de cada ruta. Se pide a git una sola vez por ruta y se refresca solo lo que cambia. */
export function useUltimosCommits(rutas: string[]): ReadonlyMap<string, Commit | undefined | null> {
  const [, setVersion] = useState(0);
  const clave = rutas.join("|");
  useEffect(() => {
    escuchar();
    const avisar = () => setVersion((v) => v + 1);
    oyentes.add(avisar);
    const faltan = rutas.filter((r) => !cache.has(r));
    faltan.forEach((r) => cache.set(r, null)); // reservada: no se pide dos veces
    if (faltan.length) void traer(faltan);
    return () => void oyentes.delete(avisar);
  }, [clave]);
  return cache;
}
