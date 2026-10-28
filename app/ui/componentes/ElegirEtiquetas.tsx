import { Plus, Search } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, useState } from "react";
import { colorEtiqueta, guardarEtiqueta, nuevaEtiqueta, opcionesEtiqueta } from "../datos/etiquetas";
import { useSesion } from "../datos/sesion";
import { ICONO } from "./Lateral";

/** Buscador y casillas del catálogo de etiquetas; si nada calza exacto, ofrece crearla. */
export function ElegirEtiquetas({ elegidas, onCambiar }: { elegidas: string[]; onCambiar: (slugs: string[]) => void }) {
  const { indice } = useSesion();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { lista, crear } = opcionesEtiqueta(indice.etiquetas, q);
  const alternar = (slug: string) => onCambiar(elegidas.includes(slug) ? elegidas.filter((s) => s !== slug) : [...elegidas, slug]);
  const nueva = async (nombre: string) => {
    const e = nuevaEtiqueta(indice.etiquetas, nombre);
    if (!e) return setError("Usa letras o números");
    try {
      await guardarEtiqueta(e);
      setError(null);
      setQ("");
      if (!elegidas.includes(e.slug)) onCambiar([...elegidas, e.slug]);
    } catch {
      setError("No se pudo crear la etiqueta. Revisa que equipo/etiquetas.md se pueda leer.");
    }
  };
  const tecla = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    if (lista.length) { alternar(lista[0].slug); setQ(""); }
    else if (crear) void nueva(crear); // nada calza: se crea
  };
  return (
    <div className="elegir-etq">
      <label className="buscar-etq">
        <Search size={ICONO} aria-hidden />
        <span className="oculto">Buscar etiqueta</span>
        <input autoFocus value={q} onChange={(ev) => setQ(ev.target.value)} onKeyDown={tecla} placeholder="Buscar o crear etiqueta…"
          aria-describedby={error ? "etq-error" : undefined} />
      </label>
      <div className="h">Etiquetas</div>
      {lista.map((e) => (
        <label key={e.slug} className="o">
          <input type="checkbox" checked={elegidas.includes(e.slug)} onChange={() => alternar(e.slug)} />
          <span className="etq" style={{ "--c": colorEtiqueta(e) } as CSSProperties}>{e.nombre}</span>
        </label>
      ))}
      {!lista.length && !crear && <div className="o vacia">Aún no hay etiquetas</div>}
      {crear && (
        <button type="button" className="o" onClick={() => void nueva(crear)}>
          <Plus size={ICONO} aria-hidden />Crear “{crear}” como etiqueta nueva
        </button>
      )}
      {error && <p id="etq-error" className="error" role="alert">{error}</p>}
    </div>
  );
}
