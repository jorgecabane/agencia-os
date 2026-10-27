import type { Commit } from "../../shared/puente";
import { titulo } from "./hoy";
import type { Persona } from "./tipos";

const MAX_DETALLE = 3;

/** Qué cosa del repo es una ruta, en palabras; null si no vale la pena contarla. */
function describir(ruta: string): string | null {
  const m = /^clientes\/([^/]+)\/(?:(entregables|reuniones|decisiones)\/)?(.+)\.md$/.exec(ruta);
  if (!m) return null;
  const [, c, carpeta, nombre] = m;
  if (carpeta === "entregables") return `${titulo(nombre).toLowerCase()} (${c})`;
  if (carpeta === "reuniones") return `una reunión de ${c}`;
  if (carpeta === "decisiones") return `una decisión de ${c}`;
  if (nombre === "linea-de-tiempo") return null; // se agrega sola con cada cambio
  if (nombre === "_ficha") return `la ficha de ${c}`;
  return `${nombre.split("/").pop()} de ${c}`;
}

function enumerar(cosas: string[]): string {
  if (cosas.length > MAX_DETALLE) return `${cosas.slice(0, 2).join(", ")} y ${cosas.length - 2} más`;
  return cosas.length === 1 ? cosas[0] : `${cosas.slice(0, -1).join(", ")} y ${cosas.at(-1)}`;
}

/** Frases "Jorge cambió carrusel lanzamiento (acme)", una por persona, sin los commits de `yo` (email). */
export function novedades(commits: Commit[], yo: string, personas: Persona[] = []): string[] {
  const porAutor = new Map<string, Set<string>>();
  for (const c of commits) {
    if (c.email.toLowerCase() === yo.toLowerCase()) continue;
    const nombre = personas.find((p) => p.nombre.toLowerCase() === c.autor.toLowerCase())?.nombre ?? c.autor;
    const cosas = porAutor.get(nombre) ?? new Set<string>();
    for (const r of c.rutas) {
      const d = describir(r);
      if (d) cosas.add(d);
    }
    porAutor.set(nombre, cosas);
  }
  return [...porAutor].filter(([, cosas]) => cosas.size).map(([quien, cosas]) => `${quien} cambió ${enumerar([...cosas])}`);
}
