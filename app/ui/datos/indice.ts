import { separar } from "./md";
import type { Aprobacion, Cliente, Decision, Entregable, Persona, Reunion } from "./tipos";

export type Indice = {
  clientes: Cliente[]; entregables: Entregable[]; reuniones: Reunion[]; decisiones: Decision[];
  personas: Persona[]; aprobaciones: Aprobacion[]; rotos: { ruta: string; error: string }[];
};
type Coleccion = Exclude<keyof Indice, "rotos">;

const REQUERIDOS: Record<string, string[]> = {
  cliente: ["nombre", "slug", "etapa", "modalidad", "responsable"],
  entregable: ["cliente", "formato", "vence", "estado", "responsable"],
  reunion: ["cliente", "fecha"], "brief-reunion": ["cliente", "fecha"], decision: ["cliente", "fecha"],
  persona: ["nombre", "slug", "rol", "nivel_automatizacion"],
  aprobacion: ["persona", "cliente", "canal", "estado"],
};
const COLECCION: Record<string, Coleccion> = {
  cliente: "clientes", entregable: "entregables", reunion: "reuniones", "brief-reunion": "reuniones",
  decision: "decisiones", persona: "personas", aprobacion: "aprobaciones",
};

const vacio = (): Indice => ({
  clientes: [], entregables: [], reuniones: [], decisiones: [], personas: [], aprobaciones: [], rotos: [],
});

/** Date de YAML → texto ISO (solo fecha si es medianoche UTC). */
function iso(v: unknown): unknown {
  if (!(v instanceof Date)) return v;
  const s = v.toISOString();
  return s.endsWith("T00:00:00.000Z") ? s.slice(0, 10) : s;
}

type Entrada = { coleccion?: Coleccion; obj?: { ruta: string }; errores: string[] };

const CARPETA: [RegExp, string[]][] = [
  [/^clientes\/[^/]+\/_ficha\.md$/, ["cliente"]],
  [/^clientes\/[^/]+\/entregables\/[^/]+\.md$/, ["entregable"]],
  [/^clientes\/[^/]+\/reuniones\/[^/]+\.md$/, ["reunion", "brief-reunion"]],
  [/^clientes\/[^/]+\/decisiones\/[^/]+\.md$/, ["decision"]],
  [/^equipo\/personas\/[^/]+\.md$/, ["persona"]],
  [/^bandeja\/[^/]+\.md$/, ["aprobacion"]],
];

function leer(ruta: string, texto: string): Entrada | null {
  const esperados = CARPETA.find(([r]) => r.test(ruta))?.[1];
  if (!esperados) return null;
  const bandeja = ruta.startsWith("bandeja/");
  const { meta, error } = separar(texto);
  if (error) return { errores: [error] };
  const tipo = meta?.tipo;
  if (bandeja && tipo !== "aprobacion") return null; // la bandeja también guarda notas libres
  if (!meta) return { errores: ["sin frontmatter"] };
  if (typeof tipo !== "string") return { errores: ["falta 'tipo'"] };
  if (!(tipo in COLECCION)) return { errores: [`tipo desconocido '${tipo}'`] };
  if (!esperados.includes(tipo)) return { errores: [`tipo '${tipo}' no corresponde a esta carpeta`] };
  const obj = { ...meta, ruta } as Record<string, unknown>;
  for (const c of ["fecha", "vence", "proximo_contacto"]) if (c in obj) obj[c] = iso(obj[c]);
  const errores = REQUERIDOS[tipo].filter((c) => meta[c] == null).map((c) => `falta '${c}'`);
  return { coleccion: COLECCION[tipo], obj: obj as { ruta: string }, errores };
}

/** Aplica cambios (ruta → contenido nuevo, o null si se borró) sin mutar el índice anterior. */
export function actualizarIndice(i: Indice, cambios: Map<string, string | null>): Indice {
  const nuevo = vacio();
  for (const k of Object.keys(nuevo) as (keyof Indice)[]) {
    (nuevo[k] as { ruta: string }[]) = (i[k] as { ruta: string }[]).filter((x) => !cambios.has(x.ruta));
  }
  for (const [ruta, texto] of cambios) {
    const e = texto === null ? null : leer(ruta, texto);
    if (!e) continue;
    for (const error of e.errores) nuevo.rotos.push({ ruta, error });
    if (e.coleccion && e.obj) (nuevo[e.coleccion] as { ruta: string }[]).push(e.obj);
  }
  for (const k of Object.keys(nuevo) as (keyof Indice)[]) {
    (nuevo[k] as { ruta: string }[]).sort((a, b) => a.ruta.localeCompare(b.ruta));
  }
  return nuevo;
}

export const construirIndice = (archivos: Map<string, string>): Indice =>
  actualizarIndice(vacio(), archivos);
