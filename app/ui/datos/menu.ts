export type Accion = "mover" | "asignar" | "reagendar" | "etiquetas" | "borrar";

const TECLAS: Record<string, Accion> = { m: "mover", a: "asignar", r: "reagendar", l: "etiquetas", backspace: "borrar" };

/** `YYYY-MM-DD` con año ≥ 2000: los años menores son el año a medio teclear en un `<input type="date">`. */
export const fechaValida = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000;

/** Letra del menú ⋯ de una tarjeta → su opción; `null` si la tecla no es de ese menú. */
export const teclaMenu = (tecla: string): Accion | null => TECLAS[tecla.toLowerCase()] ?? null;
