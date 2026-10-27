import type { Html, Parent, Root, RootContent, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { separar, unir } from "./md";

const WIKILINK = /(\[\[[^\]\n]+\]\])/;

/** Los `[[...]]` pasan como texto crudo (nodo html) para que el serializador no los escape. */
function wikilinksCrudos(nodo: Parent): void {
  nodo.children = nodo.children.flatMap((hijo): RootContent[] => {
    if ("children" in hijo) wikilinksCrudos(hijo);
    if (hijo.type !== "text") return [hijo];
    // split con grupo: las partes impares son los wikilinks
    return hijo.value.split(WIKILINK).map((parte, k): Text | Html =>
      k % 2 ? { type: "html", value: parte } : { type: "text", value: parte }).filter((n) => n.value);
  }) as Parent["children"];
}

const proceso = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(() => (arbol: Root) => wikilinksCrudos(arbol))
  .use(remarkStringify, { bullet: "-", rule: "-" });

/** Re-serializa un cuerpo markdown a las convenciones del repo: guiones en listas, `[[...]]` sin escapar, tablas GFM. */
export const serializar = (md: string): string => String(proceso.processSync(md));

/**
 * Archivo completo a guardar. El frontmatter cambia solo en las claves de `cambios` (vía `unir`); el cuerpo
 * se re-serializa solo si su contenido cambió, así abrir y cerrar no reescribe nada.
 */
export function componer(original: string, cambios: Record<string, unknown>, cuerpoEditor: string): string {
  const { fm, cuerpo } = separar(original);
  const igual = serializar(cuerpoEditor) === serializar(cuerpo);
  if (igual && !Object.keys(cambios).length) return original;
  return unir(fm, cambios, igual ? cuerpo : serializar(cuerpoEditor));
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "imagen";

/**
 * Dónde guardar una imagen pegada en `ruta`: `clientes/<c>/adjuntos/` si es de un cliente; si no,
 * `<carpeta de arriba>/adjuntos/` (o `adjuntos/` para archivos en la raíz).
 */
export function rutaAdjunto(ruta: string, nombre: string, fecha: string): string {
  const carpeta = /^clientes\/[^/]+\//.exec(ruta)?.[0] ?? (ruta.includes("/") ? `${ruta.split("/")[0]}/` : "");
  const punto = nombre.lastIndexOf(".");
  const ext = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : "png";
  return `${carpeta}adjuntos/${fecha}-${slug(punto > 0 ? nombre.slice(0, punto) : nombre)}.${ext}`;
}

/** Ruta de `destino` (desde la raíz del repo) relativa a la carpeta del archivo `desde`, para el `![](...)` del markdown. */
export function relativa(desde: string, destino: string): string {
  const a = desde.split("/").slice(0, -1);
  const b = destino.split("/");
  let k = 0;
  while (k < a.length && k < b.length - 1 && a[k] === b[k]) k++;
  return [...Array<string>(a.length - k).fill(".."), ...b.slice(k)].join("/");
}
