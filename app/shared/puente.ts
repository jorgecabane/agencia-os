/** Versión del puente: sube cuando se agregan o cambian funciones de `Puente`. */
export const SHELL_VERSION = 1;

export type Estado = "al-dia" | "subiendo" | "sin-conexion" | "conflicto";

export interface Commit {
  hash: string;
  autor: string;
  email: string;
  fecha: string;
  mensaje: string;
  rutas: string[];
}

/** Lo que el shell avisa de un turno de chat. `evento` es una línea de `claude --output-format stream-json`. */
export type EventoChat =
  | { tipo: "inicio"; commitPrevio: string | null }
  | { tipo: "evento"; evento: Record<string, unknown> }
  | { tipo: "error"; texto: string }
  | { tipo: "fin" };

export interface Config {
  repo: string | null;
  ultimoVisto: string | null;
  sesiones: Record<string, string>;
  avisos: { reuniones: boolean; actas: boolean; dia: boolean };
  /** Ids de avisos ya mostrados (para no repetirlos al reiniciar). */
  yaAvisados: string[];
  /** "Pausar avisos 1 h": ISO hasta cuándo no se avisa nada. */
  pausaHasta: string | null;
}

/** Un aviso del sistema. `id` empieza con su clase (`reunion:`, `acta:`, `dia:`); `ruta` es lo que abre al hacer clic. */
export type Aviso = { id: string; titulo: string; texto: string; ruta: string };

/** Lo que la barra o un aviso le piden a la ventana principal: abrir un archivo o mandar una captura al chat. */
export type PedidoApp = { ruta: string } | { captura: string };

/** Lo que el shell expone a la UI como `window.aos`. Las tareas siguientes lo completan. */
export interface Puente {
  shellVersion: number;
  /** Archivos del repo. Todas las rutas son relativas a la raíz y rechazan salirse de ella. */
  repo: {
    list(glob: string): Promise<string[]>;
    read(ruta: string): Promise<string>;
    write(ruta: string, contenido: string): Promise<void>;
    /** Escribe un binario (p. ej. una imagen pegada) dado en base64. */
    writeBase64(ruta: string, base64: string): Promise<void>;
    move(de: string, a: string): Promise<void>;
    delete(ruta: string): Promise<void>;
    /** Rutas cambiadas, agrupadas cada 150 ms. Devuelve cómo dejar de escuchar. */
    onCambio(cb: (rutas: string[]) => void): () => void;
  };
  sync: {
    estado(): Estado;
    onEstado(cb: (e: Estado) => void): () => void;
    /** Sincroniza ya; con `mensaje`, ese es el mensaje del commit (p. ej. "app: deshacer jorge"). */
    ahora(mensaje?: string): Promise<void>;
    /** Detiene el sync (p. ej. mientras chatea Claude). Devuelve cómo reanudar; al reanudar corre una vez. */
    pausar(): () => void;
    /** Resuelve cuando no hay un sync en curso: `pausar()` y luego `await enCurso()` antes de un turno de chat. */
    enCurso(): Promise<void>;
  };
  /** Slug de `env.AOS_PERSONA` en `.claude/settings.local.json`, o null si nadie la eligió. */
  persona(): Promise<string | null>;
  /** Guarda `env.AOS_PERSONA` en `.claude/settings.local.json` (conserva el resto del archivo). */
  guardarPersona(slug: string): Promise<void>;
  /** Config local (`~/Library/Application Support/agencia-os/config.json`). */
  config: {
    leer(): Promise<Config>;
    guardar(parcial: Partial<Config>): Promise<void>;
  };
  /** Chat con Claude Code (el `claude` de cada persona, con `cwd` = repo). */
  claude: {
    /**
     * Manda `mensaje` en la conversación `contextoId` (una por tarea, cliente o "global"), con el prefijo
     * "Estás viendo <contexto>". `envio` agrega herramientas de envío y solo vale para "Ejecuta la aprobación…".
     * Resuelve cuando termina el turno; lo que pasa llega por `onEvento`.
     */
    enviar(contextoId: string, mensaje: string, contexto: string, envio?: string[]): Promise<void>;
    onEvento(cb: (contextoId: string, e: EventoChat) => void): () => void;
    cancelar(contextoId: string): void;
  };
  git: {
    log(opts: { desde?: string; ruta?: string; max?: number }): Promise<Commit[]>;
    /** Contenido de `ruta` como quedó en el commit `hash`. */
    show(hash: string, ruta: string): Promise<string>;
    /** Nombre y correo de `git config`. */
    yo(): Promise<{ nombre: string; email: string }>;
  };
  /** Lo que toca el sistema: links, avisos, la barra de menú y la ventana principal. */
  sistema: {
    /** Abre `url` en el navegador; rechaza todo lo que no sea https. */
    abrir(url: string): Promise<void>;
    /** Muestra el aviso salvo que ya se mostró, su clase esté apagada o los avisos estén en pausa. */
    notificar(a: Aviso): void;
    /** Número junto al ícono de la barra; con `atrasado` agrega "▲". */
    icono(pendientes: number, atrasado: boolean): void;
    /** Muestra la ventana principal (la crea si estaba cerrada); con `ruta`, abre ese archivo. */
    principal(ruta?: string): void;
    /** Manda `texto` al chat de "Todo el espacio" en la ventana principal; false si Claude está ocupado. */
    capturar(texto: string): Promise<boolean>;
    /** Ventana principal: pedidos de la barra o de un aviso (incluye los que llegaron antes de escuchar). */
    onPedido(cb: (p: PedidoApp) => void): () => void;
    /** Ventana de la barra: se apretó ⌥Espacio. */
    onCaptura(cb: () => void): () => void;
    /** Ventana de la barra: alto de su contenido. */
    alto(px: number): void;
  };
}

declare global {
  interface Window {
    aos: Puente;
  }
}
