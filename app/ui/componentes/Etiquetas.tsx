import { useRef, useState } from "react";
import { parse } from "yaml";

const mostrar = (v: unknown): string => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));

/** Vuelve el texto escrito al tipo que tenía el campo: lista si era lista, número o sí/no si lo era; si no, texto. */
function leer(texto: string, antes: unknown): unknown {
  if (Array.isArray(antes)) return texto.split(",").map((x) => x.trim()).filter(Boolean);
  if (typeof antes === "number" || typeof antes === "boolean") {
    try {
      const v: unknown = parse(texto);
      if (typeof v === typeof antes) return v;
    } catch { /* queda como texto */ }
  }
  return texto;
}

const editable = (v: unknown) => v === null || Array.isArray(v) || typeof v !== "object";

/** El frontmatter como etiquetas: clic (o Enter) para editar; Enter guarda, Escape cancela. */
export function Etiquetas({ meta, onCambiar }: { meta: Record<string, unknown>; onCambiar: (clave: string, valor: unknown) => void }) {
  const [editando, setEditandoVista] = useState<string | null>(null);
  const actual = useRef<string | null>(null); // Enter y el blur que sigue no deben guardar dos veces
  const setEditando = (k: string | null) => { actual.current = k; setEditandoVista(k); };
  const [recien, setRecien] = useState<string | null>(null); // al terminar, el foco vuelve a su etiqueta
  return (
    <div className="chips etiquetas" aria-label="Propiedades">
      {Object.entries(meta).map(([k, v]) => {
        if (editando === k) {
          const terminar = (texto: string | null) => {
            if (actual.current !== k) return;
            setEditando(null);
            setRecien(k);
            if (texto !== null && texto !== mostrar(v)) onCambiar(k, leer(texto, v));
          };
          return (
            <label key={k} className="chip editando">
              <span className="k">{k}</span>
              <input autoFocus defaultValue={mostrar(v)} size={Math.max(6, mostrar(v).length + 1)}
                onBlur={(e) => terminar(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") terminar(e.currentTarget.value);
                  if (e.key === "Escape") { e.preventDefault(); terminar(null); }
                }} />
            </label>
          );
        }
        if (!editable(v)) return <span key={k} className="chip"><span className="k">{k}</span> …</span>;
        return (
          <button key={k} className="chip boton" autoFocus={recien === k} onClick={() => setEditando(k)} aria-label={`Editar ${k}: ${mostrar(v) || "vacío"}`}>
            <span className="k">{k}</span> {mostrar(v) || "—"}
          </button>
        );
      })}
    </div>
  );
}
