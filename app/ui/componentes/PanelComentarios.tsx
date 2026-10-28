import { useState } from "react";
import { agregarComentario, comentarios, menciones } from "../datos/comentarios";
import { colorPara } from "../datos/hoy";
import { cambiarCuerpo } from "../datos/md";
import { useSesion } from "../datos/sesion";
import type { Persona } from "../datos/tipos";
import { hace } from "../datos/actividad";

/** UTC `YYYY-MM-DDTHH:MMZ`, como toda marca de tiempo de máquina del repo. */
const ahoraUtc = () => `${new Date().toISOString().slice(0, 16)}Z`;

/** El texto con las @menciones a personas del equipo resaltadas. */
function ConMenciones({ texto, personas }: { texto: string; personas: Persona[] }) {
  return <>{texto.split(/(@[\p{L}\d_-]+)/u).map((t, k) => (menciones(t, personas).length ? <span key={k} className="mencion">{t}</span> : t))}</>;
}

/** Pestaña Comentarios del panel: la lista de `## Comentarios` y una caja para comentar (⌘↵ envía). */
export function PanelComentarios({ ruta, cuerpo, onError }: { ruta: string; cuerpo: string; onError: (msg: string) => void }) {
  const { indice, persona } = useSesion();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listo = texto.trim() !== "" && !enviando;
  const nombre = (slug: string) => indice.personas.find((p) => p.slug === slug)?.nombre ?? slug;

  const enviar = async () => {
    if (!listo) return;
    setEnviando(true);
    try {
      await cambiarCuerpo(ruta, (c) => agregarComentario(c, { fecha: ahoraUtc(), autor: persona, texto }));
      setTexto("");
    } catch {
      onError("No se pudo guardar el comentario. Revisa que el archivo se pueda leer.");
    }
    setEnviando(false);
  };

  const lista = comentarios(cuerpo);
  return (
    <>
      {lista.length === 0 && <p className="vacio">Aún no hay comentarios.</p>}
      <ul className="linea-act">
        {lista.map((c, k) => (
          <li key={`${c.fecha}-${k}`}>
            <span className="av" style={{ background: colorPara(c.autor) }} aria-hidden>{nombre(c.autor)[0]}</span>
            <span>
              <span className="q">{nombre(c.autor)}</span> <span className="d">comentó</span>
              <span className="comentario"><ConMenciones texto={c.texto} personas={indice.personas} /></span>
              <span className="cuando">{hace(c.fecha, new Date())}</span>
            </span>
          </li>
        ))}
      </ul>
      <form className="comentar" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <textarea
          aria-label="Comentario" placeholder="Comenta o menciona con @…" rows={2} value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enviar(); }
            if (e.key === "Escape" && texto.trim()) e.preventDefault(); // con borrador, Escape no cierra el panel
          }}
        />
        <button className="btn pri" type="submit" aria-disabled={!listo}>Comentar <kbd className="kbd">⌘↵</kbd></button>
      </form>
    </>
  );
}
