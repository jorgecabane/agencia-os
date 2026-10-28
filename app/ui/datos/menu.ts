export type Accion = "mover" | "asignar" | "reagendar" | "etiquetas" | "borrar";

const TECLAS: Record<string, Accion> = { m: "mover", a: "asignar", r: "reagendar", l: "etiquetas", backspace: "borrar" };

/** Letra del menú ⋯ de una tarjeta → su opción; `null` si la tecla no es de ese menú. */
export const teclaMenu = (tecla: string): Accion | null => TECLAS[tecla.toLowerCase()] ?? null;
