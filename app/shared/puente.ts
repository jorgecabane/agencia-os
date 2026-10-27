/** Versión del puente: sube cuando se agregan o cambian funciones de `Puente`. */
export const SHELL_VERSION = 1;

/** Lo que el shell expone a la UI como `window.aos`. Las tareas siguientes lo completan. */
export interface Puente {
  shellVersion: number;
  /** Archivos del repo. Todas las rutas son relativas a la raíz y rechazan salirse de ella. */
  repo: {
    list(glob: string): Promise<string[]>;
    read(ruta: string): Promise<string>;
    write(ruta: string, contenido: string): Promise<void>;
    move(de: string, a: string): Promise<void>;
    delete(ruta: string): Promise<void>;
    /** Rutas cambiadas, agrupadas cada 150 ms. Devuelve cómo dejar de escuchar. */
    onCambio(cb: (rutas: string[]) => void): () => void;
  };
}

declare global {
  interface Window {
    aos: Puente;
  }
}
