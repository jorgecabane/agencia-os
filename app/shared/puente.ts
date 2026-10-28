/** Versión del puente: sube cuando se agregan o cambian funciones de `Puente`. */
export const SHELL_VERSION = 1;

/** Donde se descarga la app nueva (el aviso de "Actualiza el marco" lo abre). */
export const RELEASES = "https://github.com/jorgecabane/agencia-os/releases";

export type Estado = "al-dia" | "subiendo" | "sin-conexion" | "conflicto";

/**
 * Lo que se le pide a Claude ante un conflicto de sync: el `MOTIVO_CONFLICTO` de `.claude/hooks/stop.py`
 * (sync.sh aborta el rebase, así que aquí no se sabe qué archivos chocaron). Es el único mensaje que el chat
 * acepta mientras hay conflicto.
 */
export const MOTIVO_CONFLICTO =
  "No pude sincronizar: un compañero cambió lo mismo que tú.\nLos archivos en conflicto aparecen al correr `git pull --rebase`.\n" +
  "Corre `git pull --rebase`, y en cada archivo en conflicto conserva lo de ambos (si se " +
  "contradicen, deja lo más reciente y anota la diferencia en la bandeja del dueño). Valida con " +
  "`uv run scripts/validar.py`, `git add` + `git rebase --continue`, `git push`, y cuéntale al " +
  "usuario en una línea qué mezclaste.";

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
  avisos: { reuniones: boolean; actas: boolean; dia: boolean; menciones: boolean };
  /** Ids de avisos ya mostrados (para no repetirlos al reiniciar). */
  yaAvisados: string[];
  /** "Pausar avisos 1 h": ISO hasta cuándo no se avisa nada. */
  pausaHasta: string | null;
  /** El chat de Claude a la derecha queda abierto (⌘J lo alterna). */
  chatAbierto: boolean;
}

/** Un aviso del sistema. `id` empieza con su clase (`reunion:`, `acta:`, `dia:`, `mencion:`); `ruta` es lo que abre al hacer clic. */
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
     * "Estás viendo <contexto>". Solo "Ejecuta la aprobación bandeja/<x>.md" suma herramientas de envío: el shell
     * lee ese archivo, exige `tipo: aprobacion` y `estado: aprobado` y da solo las del conector de su `canal`.
     * Resuelve cuando termina el turno; lo que pasa llega por `onEvento`.
     */
    enviar(contextoId: string, mensaje: string, contexto: string): Promise<void>;
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
    /** Salida de `claude mcp list` (los conectores de Claude Code); rechaza con un texto para mostrar. */
    conectores(): Promise<string>;
    /** Pide otra carpeta del repo y reinicia la app con ella; false si se canceló. */
    cambiarRepo(): Promise<boolean>;
    /** Cambió `app/ui-dist` (llegó una versión nueva de la UI con el sync). La UI decide cuándo recargarse. */
    onNuevaUI(cb: () => void): () => void;
    /** Vuelve a cargar la UI de esta ventana. */
    recargar(): void;
  };
}

declare global {
  interface Window {
    aos: Puente;
  }
}
