import { algunoEnCurso, leerRevision } from "./chat";

type EditorVivo = { sinGuardar: () => boolean; montado: () => boolean };
// Un editor que se cerró sigue aquí hasta terminar de guardar: recargar antes perdería ese guardado.
const editores = new Set<EditorVivo>();

export const registrarEditor = (e: EditorVivo): void => void editores.add(e);

export function hayEditorSinGuardar(): boolean {
  for (const e of editores) if (!e.montado() && !e.sinGuardar()) editores.delete(e);
  return [...editores].some((e) => e.sinGuardar());
}

/** Recargar la UI no pierde nada: ningún editor con cambios sin guardar, ni un turno de Claude corriendo o sin revisar (Deshacer vive en memoria). */
export const sePuedeRecargar = (): boolean => !hayEditorSinGuardar() && !algunoEnCurso() && leerRevision() === null;
