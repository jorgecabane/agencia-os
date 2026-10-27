import { useRef, useState } from "react";

const mostrar = (v: unknown): string => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));

const SI_NO: Record<string, boolean> = { "sí": true, si: true, true: true, no: false, false: false };

/** Vuelve el texto escrito al tipo que tenía el campo: lista si era lista, número o sí/no si lo era; si no, texto. */
export function leer(texto: string, antes: unknown): { valor: unknown } | { error: string } {
  const t = texto.trim();
  if (Array.isArray(antes)) return { valor: t.split(",").map((x) => x.trim()).filter(Boolean) };
  if (typeof antes === "boolean") {
    const v = SI_NO[t.toLowerCase()];
    return v === undefined ? { error: "Escribe sí o no" } : { valor: v };
  }
  if (typeof antes === "number") return t !== "" && Number.isFinite(Number(t)) ? { valor: Number(t) } : { error: "Escribe un número" };
  return { valor: texto };
}

const editable = (v: unknown) => v === null || Array.isArray(v) || typeof v !== "object";

/** El frontmatter como etiquetas: clic (o Enter) para editar; Enter guarda, Escape cancela. */
export function Etiquetas({ meta, onCambiar }: { meta: Record<string, unknown>; onCambiar: (clave: string, valor: unknown) => void }) {
  const [editando, setEditandoVista] = useState<string | null>(null);
  const actual = useRef<string | null>(null); // Enter y el blur que sigue no deben guardar dos veces
  const setEditando = (k: string | null) => { actual.current = k; setEditandoVista(k); };
  const [recien, setRecien] = useState<string | null>(null); // al terminar, el foco vuelve a su etiqueta
  const [error, setError] = useState<string | null>(null);
  return (
    <>
    <div className="chips etiquetas" aria-label="Propiedades">
      {Object.entries(meta).map(([k, v]) => {
        if (editando === k) {
          // Enter con un valor inválido sigue editando; al salir con uno inválido no se guarda y queda el aviso.
          const terminar = (texto: string | null, seguir = false) => {
            if (actual.current !== k) return;
            const r = texto === null || texto === mostrar(v) ? null : leer(texto, v);
            if (r && "error" in r) {
              setError(seguir ? r.error : `${r.error}: no se guardó ${k}`);
              if (seguir) return;
            } else setError(null);
            setEditando(null);
            setRecien(k);
            if (r && "valor" in r) onCambiar(k, r.valor);
          };
          return (
            <label key={k} className="chip editando">
              <span className="k">{k}</span>
              <input autoFocus aria-invalid={!!error} aria-describedby={error ? "etiqueta-error" : undefined} defaultValue={mostrar(v)} size={Math.max(6, mostrar(v).length + 1)}
                onBlur={(e) => terminar(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") terminar(e.currentTarget.value, true);
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
    {error && <p id="etiqueta-error" role="alert" className="error-etiqueta">⚠ {error}</p>}
    </>
  );
}
