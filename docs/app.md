# App de escritorio

Una ventana para el día a día (Hoy, clientes, tareas, chat con Claude) sin abrir la terminal. Trabaja sobre el mismo repo: todo lo que hace queda como commit.

## Instalar

1. Baja `agencia-os.zip` desde [Releases](https://github.com/jorgecabane/agencia-os/releases).
2. Descomprímelo y mueve `agencia-os.app` a Aplicaciones.
3. La primera vez, clic derecho sobre la app → **Abrir** → **Abrir** (no está firmada, así que macOS pregunta una vez).

## Primer uso

1. Elige la carpeta de tu repo de agencia-os.
2. Elige quién eres (tu persona). Si ya corriste `/bienvenida`, viene preseleccionada.

Después queda un ícono en la barra de menú (aprobaciones, reuniones y estado del sync) y puedes abrir la app desde cualquier lado con **⌥ Espacio**.

## Cómo se actualiza

- **La interfaz** se actualiza sola: vive en el repo (`app/ui-dist/`) y llega con el sync (git), igual que el resto del contenido.
- **El marco de la app** (la ventana, la barra de menú, el chat) cambia poco. Si hace falta uno nuevo, la app te avisa; bajas el nuevo release y reemplazas la app.

## Mejorar la interfaz

1. Edita los archivos de `app/ui/`.
2. Compila: `pnpm --dir app build:ui`.
3. Haz commit incluyendo `app/ui-dist/`. Cuando el equipo haga sync, todos ven el cambio.
