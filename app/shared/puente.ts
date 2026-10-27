/** Versión del puente: sube cuando se agregan o cambian funciones de `Puente`. */
export const SHELL_VERSION = 1;

/** Lo que el shell expone a la UI como `window.aos`. Las tareas siguientes lo completan. */
export interface Puente {
  shellVersion: number;
}

declare global {
  interface Window {
    aos: Puente;
  }
}
