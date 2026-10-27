// Campos según scripts/aos/esquemas.py. Las fechas son siempre texto ISO.
export type Cliente = {
  ruta: string; nombre: string; slug: string; etapa: string; modalidad: string; responsable: string;
  dominios_email?: string[]; emails?: string[]; proximo_contacto?: string; drive?: string;
  /** Link (https) al espacio del cliente en ClickUp. */
  clickup?: string;
};
export type Entregable = {
  ruta: string; cliente: string; formato: string; vence: string; estado: string; responsable: string;
  origen?: string; fecha_tentativa?: boolean;
};
export type Reunion = {
  ruta: string; tipo: "reunion" | "brief-reunion"; cliente: string; fecha: string;
  asistentes?: string[]; link?: string; fuente?: string;
};
export type Decision = { ruta: string; cliente: string; fecha: string; origen?: string };
export type Persona = {
  ruta: string; nombre: string; slug: string; rol: string; nivel_automatizacion: string; zona_horaria?: string;
};
export type Aprobacion = { ruta: string; persona: string; cliente: string; canal: string; estado: string };
export type Promesa = {
  quien: string; que: string; fecha: string | null; hecha: boolean; delCliente: boolean; acta: string;
};
