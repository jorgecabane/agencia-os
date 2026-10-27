import { useEffect, useState } from "react";
import type { Commit } from "../../shared/puente";
import { autor, hace } from "../datos/actividad";
import { titulo } from "../datos/hoy";
import { useSesion } from "../datos/sesion";

const MAX_VERSIONES = 50;
// Solo se agregan líneas al final: restaurar una versión vieja borraría eventos o bitácoras.
const SOLO_AGREGAR = /(^|\/)linea-de-tiempo\.md$|^sesiones\//;

type Version = { commit: Commit; texto: string };

/** Versiones de un archivo (git log), una de ellas en solo lectura y, salvo en archivos que solo crecen, "Restaurar". */
export function Historial({ ruta, onVolver }: { ruta: string; onVolver: () => void }) {
  const { indice } = useSesion();
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [sel, setSel] = useState<Version | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restaurable = !SOLO_AGREGAR.test(ruta);

  useEffect(() => {
    let vivo = true;
    window.aos.git.log({ ruta, max: MAX_VERSIONES })
      .then((cs) => vivo && setCommits(cs), () => vivo && setError("No pude leer el historial de este archivo."));
    return () => { vivo = false; };
  }, [ruta]);

  const ver = (commit: Commit) => {
    setConfirmando(false);
    setError(null);
    window.aos.git.show(commit.hash, ruta)
      .then((texto) => setSel({ commit, texto }), () => setError("No pude abrir esa versión."));
  };
  const restaurar = (texto: string) =>
    window.aos.repo.write(ruta, texto).then(onVolver, () => setError("No pude restaurar la versión. Revisa que el archivo se pueda escribir."));
  const fecha = (c: Commit) => new Date(c.fecha).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="historial" aria-label={`Historial de ${titulo(ruta)}`}>
      <div className="historial-cabeza">
        <button className="btn plano" onClick={onVolver}>‹ Volver al documento</button>
        <h2>Historial de {titulo(ruta)}</h2>
      </div>
      {error && <p className="error" role="alert">⚠ {error}</p>}
      <div className="historial-cuerpo">
        <ol className="versiones" aria-label="Versiones">
          {commits?.map((c) => (
            <li key={c.hash}>
              <button className="version" aria-pressed={sel?.commit.hash === c.hash} onClick={() => ver(c)}>
                <span className="t">{autor(c, indice.personas)}, {hace(c.fecha, new Date())}</span>
                <span className="sub">{fecha(c)}</span>
              </button>
            </li>
          ))}
          {commits?.length === 0 && <li className="vacio">Este archivo aún no tiene versiones guardadas.</li>}
        </ol>
        <div className="vista-version">
          {sel ? (
            <>
              <div className="acciones">
                <span className="nota">Versión de {autor(sel.commit, indice.personas)}, {fecha(sel.commit)} (solo lectura)</span>
                {restaurable && !confirmando && <button className="btn" onClick={() => setConfirmando(true)}>Restaurar</button>}
                {!restaurable && <span className="nota">ⓘ Este archivo solo crece: no se restaura.</span>}
              </div>
              {confirmando && (
                <div className="confirmar" role="alert">
                  <span>¿Reemplazar el documento por esta versión? Lo de ahora queda en el historial.</span>
                  <button className="btn pri" onClick={() => void restaurar(sel.texto)}>Sí, restaurar</button>
                  <button className="btn plano" onClick={() => setConfirmando(false)}>Cancelar</button>
                </div>
              )}
              <pre className="crudo" tabIndex={0} aria-label="Contenido de la versión">{sel.texto}</pre>
            </>
          ) : (
            <p className="vacio">Elige una versión para verla.</p>
          )}
        </div>
      </div>
    </section>
  );
}
