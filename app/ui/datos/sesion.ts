import { createContext, useContext, useEffect, useState } from "react";
import { actualizarIndice, construirIndice, type Indice } from "./indice";

/** Lo que toda pantalla necesita: el índice del repo y quién está usando la app. */
export type Sesion = { indice: Indice; persona: string };
export const SesionCtx = createContext<Sesion | null>(null);
export const useSesion = (): Sesion => {
  const s = useContext(SesionCtx);
  if (!s) throw new Error("useSesion fuera de <SesionCtx>");
  return s;
};

const INDEXADOS = ["clientes/**/*.md", "equipo/personas/*.md", "bandeja/*.md"];
const ES_INDEXADO = /^(clientes\/.+|equipo\/personas\/[^/]+|bandeja\/[^/]+)\.md$/;

async function leerTodas(rutas: string[]): Promise<Map<string, string | null>> {
  const textos = await Promise.all(rutas.map((r) => window.aos.repo.read(r).catch(() => null)));
  return new Map(rutas.map((r, k) => [r, textos[k]]));
}

/** Índice del repo: se arma al abrir y se actualiza con cada cambio de archivo. */
export function useIndice(): Indice | null {
  const [indice, setIndice] = useState<Indice | null>(null);
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
    })();
    return () => {
      vivo = false;
      quitar();
    };
  }, []);
  return indice;
}
