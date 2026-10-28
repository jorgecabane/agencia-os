import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { actualizarIndice, construirIndice, type Indice } from "./indice";

/** Lo que toda pantalla necesita: el índice del repo y quién está usando la app. */
export type Sesion = { indice: Indice; persona: string };
export const SesionCtx = createContext<Sesion | null>(null);
export const useSesion = (): Sesion => {
  const s = useContext(SesionCtx);
  if (!s) throw new Error("useSesion fuera de <SesionCtx>");
  return s;
};

const INDEXADOS = ["clientes/**/*.md", "equipo/personas/*.md", "equipo/etiquetas.md", "bandeja/*.md"];
const ES_INDEXADO = /^(clientes\/.+|equipo\/personas\/[^/]+|equipo\/etiquetas|bandeja\/[^/]+)\.md$/;

async function leerTodas(rutas: string[]): Promise<Map<string, string | null>> {
  const textos = await Promise.all(rutas.map((r) => window.aos.repo.read(r).catch(() => null)));
  return new Map(rutas.map((r, k) => [r, textos[k]]));
}

export type CargaIndice = { indice: Indice | null; error: string | null; reintentar: () => void };

/** Índice del repo: se arma al abrir y se actualiza con cada cambio de archivo. */
export function useIndice(): CargaIndice {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vivo = true;
    const pendientes: Map<string, string | null>[] = [];
    const quitar = window.aos.repo.onCambio(async (rutas) => {
      const cambios = await leerTodas(rutas.filter((r) => ES_INDEXADO.test(r)));
      if (!vivo || !cambios.size) return;
      setIndice((i) => (i ? actualizarIndice(i, cambios) : (pendientes.push(cambios), i)));
    });
    void (async () => {
      const rutas = (await Promise.all(INDEXADOS.map((g) => window.aos.repo.list(g)))).flat();
      const archivos = await leerTodas(rutas);
      const legibles = new Map([...archivos].filter((e): e is [string, string] => e[1] !== null));
      if (!vivo) return;
      // Lo que cambió mientras se leía el repo se aplica encima.
      setIndice(pendientes.reduce(actualizarIndice, construirIndice(legibles)));
    })().catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
      quitar();
    };
  }, [intento]);
  const reintentar = useCallback(() => { setError(null); setIntento((n) => n + 1); }, []);
  return { indice, error, reintentar };
}
