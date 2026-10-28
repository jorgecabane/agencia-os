import { stringify } from "yaml";
import { fechaLocal } from "./hoy";
import type { Indice } from "./indice";
import { slugDe } from "./resumen";

export type NuevaTarea = { titulo: string; cliente: string; responsable: string; vence: string; estado: string; etiquetas: string[] };

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Saca `@persona` (o `@claude` = ia) y `#cliente` del texto; lo reconocido se quita del título. */
export function interpretar(texto: string, i: Indice): { titulo: string; cliente?: string; responsable?: string } {
  let cliente: string | undefined;
  let responsable: string | undefined;
  const titulo = texto.replace(/([@#])([\p{L}\d_-]+)/gu, (todo, marca: string, palabra: string) => {
    const p = norm(palabra);
    if (marca === "#") {
      const c = i.clientes.find((x) => x.slug === palabra.toLowerCase() || norm(x.nombre) === p);
      if (!c || cliente) return todo;
      cliente = c.slug;
      return "";
    }
    const slug = p === "claude" ? "ia" : i.personas.find((x) => x.slug === p || norm(x.nombre.split(/\s+/)[0]) === p)?.slug;
    if (!slug || responsable) return todo;
    responsable = slug;
    return "";
  }).replace(/\s+/g, " ").trim();
  return { titulo, cliente, responsable };
}

/** `clientes/<c>/entregables/<vence>-<slug>.md`; si ya existe suma `-2`, `-3`... */
export function rutaNueva(t: NuevaTarea, existentes: Set<string>): string {
  const base = `clientes/${t.cliente}/entregables/${t.vence}-${slugDe(t.titulo)}`;
  let ruta = `${base}.md`;
  for (let n = 2; existentes.has(ruta); n++) ruta = `${base}-${n}.md`;
  return ruta;
}

export function archivoNueva(t: NuevaTarea): string {
  const meta = {
    tipo: "entregable", titulo: t.titulo, cliente: t.cliente, formato: "tarea", vence: t.vence,
    estado: t.estado, responsable: t.responsable, ...(t.etiquetas.length ? { etiquetas: t.etiquetas } : {}),
  };
  return `---\n${stringify(meta, { lineWidth: 0 })}---\n## Brief\n\n`;
}

/** Escribe la tarea y, si el cliente tiene línea de tiempo, anota `entregable_creado`. Devuelve la ruta. */
export async function crearTarea(t: NuevaTarea, persona: string, existentes: Set<string>): Promise<string> {
  const ocupadas = new Set(existentes);
  let ruta = rutaNueva(t, ocupadas);
  // Un sync pudo traer el archivo después de armar `existentes`: se revisa el repo antes de escribir.
  while ((await window.aos.repo.list(ruta)).includes(ruta)) {
    ocupadas.add(ruta);
    ruta = rutaNueva(t, ocupadas);
  }
  await window.aos.repo.write(ruta, archivoNueva(t));
  const linea = `clientes/${t.cliente}/linea-de-tiempo.md`;
  const actual = await window.aos.repo.read(linea).catch(() => null);
  if (actual === null) return ruta;
  const evento = `${fechaLocal()} · entregable_creado · [[${ruta.replace(/\.md$/, "")}]] ${t.titulo} · ${persona}`;
  await window.aos.repo.write(linea, `${actual}${actual.endsWith("\n") || actual === "" ? "" : "\n"}${evento}\n`);
  return ruta;
}
