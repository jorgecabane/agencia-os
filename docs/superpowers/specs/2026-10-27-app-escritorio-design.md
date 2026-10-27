# agencia-os · App de escritorio (fase 2) — Diseño

Fecha: 2026-10-27. Reemplaza a Obsidian como capa visual (sacado del repo el 2026-10-26). Diseño base del
sistema: `docs/superpowers/specs/2026-10-23-agencia-os-design.md` (sigue vigente salvo lo que se dice aquí).
Bocetos aprobados: `docs/superpowers/specs/mockups-app/*.html` (abrirlos en el navegador).

## 1. Intención

El equipo (dueño + 1 marketing + 1 dev) trabaja conversando con Claude y el repo de markdown es la única
fuente de verdad. A la persona de marketing no la imaginamos usando la terminal: hoy usa la app de Claude
(pestaña Code) y, con esto, una app propia tipo Granola/Notion simplificado donde:

- abre la app y ve **lo que le toca hoy, con una propuesta lista para cada tarea** (lo crítico del día uno);
- hace clic en una tarea, ve propuestas e inspiración, conversa con Claude ahí mismo y ve los cambios en vivo;
- recorre cada cliente, edita su documentación como en Notion y agrega páginas;
- ve el tablero del equipo para saber cómo van los entregables de los demás;
- vive también en la barra de arriba del Mac.

La app es una **vista y un editor sobre el repo**: no tiene base de datos propia ni servidor. Todo lo que
muestra sale de los `.md`; todo lo que edita vuelve a los `.md`, git lo versiona y el sync lo reparte.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos (v1, todo entra; después se itera):**
1. Hoy (solo lo mío) con propuestas por tarea, y panel de detalle con acciones y chat.
2. Tablero del equipo (kanban) con filtros estilo Linear.
3. Página de cliente: Resumen automático + pestañas editables tipo Notion + pestañas nuevas.
4. Chat con Claude en contexto, con pasos visibles, cambios en vivo y Aceptar / Deshacer todo.
5. Barra de menú: reuniones de hoy, brief de la próxima, mis entregas, captura rápida, avisos.
6. Calendario de entregas, Aprobaciones y Configuración (skills, conectores, avisos), con el mismo norte de diseño.
7. Sync casi en tiempo real (≤ 60 s) en ambos sentidos.
8. La interfaz se actualiza sola para todos cuando alguien la cambia en el repo.

**No-objetivos:** web o móvil; Windows/Linux; colaboración letra por letra tipo Google Docs; servidor
propio; reemplazar los conectores de claude.ai; ClickUp y métricas (siguen en sus fases).

**Anti-objetivos (fracaso aunque funcione):**
- Que la app guarde algo que no esté en el repo (otra fuente de verdad).
- Que edite el markdown de forma que Claude o el validador ya no lo entiendan (frontmatter roto, wikilinks perdidos).
- Que publique o envíe algo hacia afuera sin aprobación humana.
- Que se vea genérica: el norte de diseño es `mockups-app/tablero-v2.html`.
- Que una persona pierda trabajo por un conflicto de sync.

## 3. Decisiones tomadas

**Del dueño del espacio:**
- Fuera Obsidian; app propia, ventana + barra de menú del Mac, que se actualiza sola.
- Hoy muestra solo lo mío; lo del equipo va en el Tablero (kanban global estilo Trello/Linear).
- Página de cliente estilo Notion: Resumen dinámico y no editable; el resto editable (texto, títulos,
  tablas, imágenes, pestañas nuevas).
- Chat como Granola: con el contexto de lo que estás viendo, propone, edita y se ve en vivo.
- Las conversaciones se documentan igual que trabajar con Claude en el repo hoy: cada cosa donde
  corresponde (decisión, tarea, aprendizaje); no se guarda la conversación completa.
- Norte de diseño: el tablero v2. Usar `/emil-design-eng` (y frontend-design) al construir la UI.
- Construir todo con lo que llevamos e iterar después.

**Mías (revisables):**
- **Electron + React + TypeScript + Vite**, no Tauri: un solo lenguaje, no hay Rust instalado, y el peso
  de la app no importa para tres personas. Gestor: pnpm (ya instalado).
- Solo macOS en v1. La app sin firmar se abre con clic derecho → Abrir la primera vez.
- Editor: **Milkdown Crepe** (ProseMirror + remark, markdown nativo, menú "/", manillas de bloque, tablas
  GFM, imágenes). El frontmatter no pasa por el editor: se muestra como etiquetas editables.
- Claude dentro de la app = el `claude` CLI de cada persona en modo `-p --output-format stream-json`,
  con su plan, sus skills y los hooks del repo. Sin API key ni cobro aparte.
- Imágenes ≤ 2 MB van a `clientes/<c>/adjuntos/`; más pesadas y videos, link a Drive.
- Reuniones en Hoy y en la barra: solo las de clientes (las que tienen brief en el repo). Las personales e
  internas no están en el repo por privacidad y no aparecen.

## 4. Arquitectura

```
agencia-os/                      (el mismo repo)
  app/
    shell/        proceso principal de Electron: ventanas, bandeja de menú, git/sync, archivos, claude
    ui/           React (renderer): todas las pantallas
    ui-dist/      build de ui/ COMMITEADO: es lo que carga la app
    package.json
```

- **El marco (shell)** se instala una vez por persona (`.app`). Al abrir por primera vez pide la carpeta
  del repo (la recuerda en `~/Library/Application Support/agencia-os/config.json`).
- **La interfaz se carga desde el repo**: el shell carga `<repo>/app/ui-dist/index.html`. Quien cambia la UI
  (normalmente Claude) corre el build y commitea `ui-dist/`; el sync la reparte y la app se recarga sola
  al detectar cambios en `ui-dist/`. Así "mejorar la app" = un commit, sin reinstalar. Si `ui-dist/` no
  existe o no carga, el shell muestra la UI que trae empaquetada.
  - Regla en `CLAUDE.md`: si tocas `app/ui/`, corre `pnpm --dir app build:ui` y commitea `ui-dist/` en el mismo commit.
  - Riesgo aceptado: la UI cargada del repo tiene acceso a las funciones del shell. Es el repo privado
    del equipo, que ya puede ejecutar hooks; no se cargan URLs remotas.
- **Puente shell ↔ UI** (IPC tipado, un archivo de tipos compartido). Funciones mínimas:
  - `repo.list(glob)`, `repo.read(path)`, `repo.write(path, contenido)` (escritura atómica), `repo.move`, `repo.delete`
    (borrar = solo lo que el usuario pide en la UI; la regla "nunca borrar automático" sigue para Claude).
  - `repo.watch` → eventos `cambiado(paths)`.
  - `git.log(desde)`, `git.estado()`, `sync.ahora()`.
  - `claude.enviar(conversacionId, mensaje, contexto)` → stream de eventos; `claude.cancelar`.
  - `persona()` (lee `AOS_PERSONA` de `.claude/settings.local.json`), `notificar(...)`, `abrir(url)`.
- **Modelo de datos en la UI**: se parsean los `.md` (frontmatter con `yaml`, cuerpo como texto) y se arma
  en memoria el índice: clientes, entregables, reuniones/briefs, decisiones, personas, bandeja. Se
  rehace incremental con cada evento del watcher. Mismos campos y reglas que `scripts/aos/esquemas.py`
  (el validador Python sigue siendo la autoridad; la UI valida antes de guardar lo que ella edita).

## 5. Sync

- **Reusa `.claude/hooks/sync.sh`**, con dos cambios: acepta el mensaje de commit como primer argumento
  (default: el actual `sesión: …`) y sale **4** cuando falla por red (antes 0). Códigos: 0 al día o nada
  que hacer, 3 conflicto, 4 sin conexión. El hook Stop solo reacciona al 3, así que nada cambia para él.
- Disparadores: 5 s después de la última escritura desde la app; cada 45 s; al volver el foco a la
  ventana; al terminar cada respuesta de Claude (ya lo hace el hook Stop).
- Un solo sync a la vez (cola); si hay un rebase en curso, espera.
- Indicador abajo: "Al día", "Subiendo N cambios", "Sin conexión, reintento", "Conflicto".
- Conflicto (sale 3): la app no toca nada y ofrece "Pedirle a Claude que lo mezcle", que abre el chat con
  el mismo mensaje del hook Stop (`MOTIVO_CONFLICTO`). Nunca `--force`.
- "Desde tu última visita": `git log` desde el último commit visto (guardado en el config local),
  agrupado por persona, en frases humanas ("Jorge movió el carrusel al 30").
- Mensaje de commit de la app: `app: <persona> <YYYY-MM-DDTHH:MMZ>`.

## 6. Pantallas

Todas con el norte de diseño (tokens de `tablero-v2.html`: fondo #242322, superficies #2b2a28/#343230,
texto #ece9e2, acento de foco #a7b0ff, avance #8fc79a, atraso #e58b7b; títulos en Newsreader, UI en la
fuente del sistema; color por cliente como identidad). Barra lateral común: Hoy, Aprobaciones,
Calendario, Tablero, clientes (con su color), Configuración. Estado vacío = invitación a actuar.

### 6.1 Hoy (`mockups-app/hoy.html`) — lo crítico
Solo de la persona actual:
- Reuniones de hoy (briefs con `fecha` hoy y la persona en `asistentes`).
- Entregas: `responsable` = yo, no publicado/cancelado, vence ≤ hoy (+ atrasadas) y fechas tentativas.
- Lo que nos debe el cliente (promesas del cliente abiertas en clientes donde soy responsable). Se leen
  de las actas: líneas `- [ ] <quien>: <qué> (<YYYY-MM-DD|sin fecha>)` bajo `## Promesas` cuyo `<quien>`
  no es un slug de `equipo/personas/` (es un contacto del cliente). Las nuestras ya son entregables.
- Línea "Desde tu última visita".
- Clic en un ítem → **panel derecho**: etiquetas (cliente, formato, vence, estado), contexto en una línea,
  **propuestas** (de la sección `## Propuestas` del entregable), inspiración (imágenes de `adjuntos/` o
  links de `material.md` que la propuesta cite), acciones (Desarrollar, Editar, Reagendar, Asignar,
  Borrar) y el chat de esa tarea. Reagendar = cambiar `vence`; Asignar = cambiar `responsable`.
- **Propuestas por tarea**: hoy `brief-del-dia` las escribe en la bandeja. Cambia: además las escribe en
  cada entregable bajo `## Propuestas` (2–3 opciones, la recomendada primero; reemplaza la sección cada
  día). La bandeja sigue como resumen.

### 6.2 Tablero (`mockups-app/tablero-v2.html`) — norte de diseño
- Columnas por `estado` (brief, en_curso, revision, aprobado, publicado; cancelado oculto). Arrastrar
  cambia `estado`. Agrupar por persona = filas por `responsable`.
- Vistas guardadas (Esta semana, Todo, Atrasado, Esperando al cliente, + Vista) guardadas en
  `app/vistas.json` del repo (compartidas por el equipo).
- Caras del equipo como filtro; chips de filtro con ×; menú "Filtrar" (tecla F) con buscador y conteos
  por persona, cliente, formato, vence, estado.
- Tarjeta: título, cliente con color, actividad (ícono + texto: avanzó / quieta N días / sin abrir), vence,
  responsable. La actividad sale de `git log` del archivo (último autor y fecha).
- Clic → el mismo panel de Hoy.

### 6.3 Cliente (`mockups-app/cliente.html`, `cliente-editor.html`)
- Cabecera: nombre, color, etapa, modalidad, responsable, dominio, links (Drive, ClickUp).
- **Resumen (automático, no editable)**: lo próximo (siguiente reunión con su brief), entregables
  abiertos, lo que nos debe, salud de la semana (de `metricas/` si existe; si no, se oculta), lo que
  aprendimos (link a editar en Contexto), línea de tiempo.
- Pestañas fijas que son listas: Entregables, Reuniones, Decisiones. Cada elemento se abre como página
  con su frontmatter como etiquetas editables y el cuerpo en el editor.
- Pestañas que son documentos: Contexto, Brandbook, Plan, Material, y **cualquier `.md` nuevo** en
  `clientes/<c>/paginas/`. "+" ofrece: página en blanco, vista de tareas del cliente (tabla/tablero/
  calendario, guardada en `app/vistas.json`) o pedírsela a Claude.
- Editor (Milkdown Crepe): "/" inserta título, tabla, lista de tareas, imagen, pedirle a Claude; manillas
  para mover bloques; guardado automático; "Editado por X hace N · historial" (historial = `git log` del archivo, con vista de una versión anterior y "restaurar").
- **Guardado**: automático 1 s después de dejar de escribir. Si el archivo cambia por fuera (Claude o un
  compañero) mientras hay cambios sin guardar: no se recarga; al guardar se hace una mezcla de tres
  vías (versión base, la tuya, la de afuera) y, si chocan, se guardan ambas versiones del bloque y un
  aviso "Cambió mientras editabas: revisa" con opción de pedirle a Claude que lo mezcle. Nunca se pierde
  lo escrito. Sin cambios locales, se recarga en vivo.
- **Fidelidad**: el frontmatter se conserva tal cual (solo cambian los campos editados). El cuerpo se
  re-serializa completo con remark configurado a las convenciones del repo (guiones para listas, `[[` sin
  escapar, tablas GFM); se acepta que la primera edición normalice el formato. Obligatorio: abrir sin editar no escribe el archivo; wikilinks `[[...]]`,
  checkboxes `- [ ]` y tablas sobreviven ida y vuelta. Si el editor no puede representar algo, el bloque se muestra como markdown crudo editable.

### 6.4 Chat (`mockups-app/chat.html`)
- Se abre en el panel derecho o con ⌘J. Etiqueta de contexto arriba (tarea, cliente, "Hoy" o "Todo el espacio").
- Cada mensaje se envía como `claude -p --output-format stream-json --verbose --permission-mode acceptEdits`
  con `cwd` = repo, `AOS_PERSONA` en el entorno, `--resume <session_id>` para seguir la conversación de
  ese contexto (session ids en el config local, uno por contexto), y el contexto como prefijo:
  "Estás viendo <ruta>. Persona: <slug>." El CLAUDE.md, las skills y los hooks del repo aplican igual.
- Muestra los pasos en lenguaje humano a partir de los eventos (leer archivo → "Leí el brandbook",
  skill → "Usando ig-carousel"), el texto de Claude y, si pide aprobación para algo hacia afuera, una
  tarjeta de aprobación.
- **En vivo**: el documento abierto se recarga con cada cambio del watcher; lo nuevo se marca.
- **Aceptar / Deshacer todo**: antes de cada mensaje se guarda el commit actual; los archivos que tocó
  Claude en ese turno salen de los eventos de herramientas. Deshacer = restaurar esos archivos a su
  contenido previo y commitear `app: deshacer <persona>`. Aceptar = solo quitar las marcas.
- Atajos (recetas) según el contexto: los nombres de skills relevantes y acciones cortas ("Más corto").
- Lo que sale de la conversación se documenta según CLAUDE.md (no hay nada especial que hacer en la app).
- **Permisos** (mi decisión): `-p` no puede preguntar, así que el chat corre con una lista de permitidos
  fija pasada por `--allowedTools`: Read, Edit, Write, Glob, Grep, Skill, `Bash(uv run *)`, `Bash(git *)`,
  `Bash(pnpm --dir app *)` y las herramientas de **lectura** de los conectores. Las que envían o publican
  hacia afuera no están permitidas en un turno normal: Claude deja el borrador como `aprobacion` y lo dice
  en texto. Solo el turno que lanza "Ejecuta la aprobación <ruta>" (desde Aprobaciones) agrega las
  herramientas de envío del canal de esa aprobación. Lo que se deniegue aparece en el chat como paso
  fallido con su nombre, para ajustar la lista.
- **Sync durante un turno**: pausado. El sync de la app no corre mientras Claude responde; al terminar,
  el hook Stop sincroniza y la app retoma su ciclo.
- **Deshacer** restaura solo los archivos que Claude tocó en el turno, **salvo** los de solo-agregar
  (`linea-de-tiempo.md`, `sesiones/`), que nunca se editan hacia atrás.

### 6.5 Barra de menú (`mockups-app/barra.html`)
- Ícono con número de pendientes de hoy y punto si hay algo atrasado.
- Próxima reunión con cuenta regresiva, "Abrir brief" y "Unirme" (campo `link` del brief-reunion).
- Más tarde hoy; mis entregas de hoy con casilla (avanza su estado, ver § 9); aprobaciones
  esperando; captura rápida (⌥Espacio global) que manda el texto a Claude con contexto "Todo el espacio";
  "Abrir agencia-os" (⌘O); estado del sync; pausar avisos 1 h.
- Avisos del sistema: 10 min antes de cada reunión con su brief; acta nueva donde soy asistente ("Acta
  lista: N tareas nuevas"); resumen del día cuando aparece la bandeja de hoy.

### 6.6 Calendario, Aprobaciones, Configuración (sin boceto; mismo norte)
- **Calendario**: mes/semana de entregables por `vence` y reuniones por `fecha`, color por cliente,
  mismos filtros que el Tablero, arrastrar cambia `vence` (nunca `recurrencia_fecha`).
- **Aprobaciones**: archivos `bandeja/*.md` con `tipo: aprobacion` (nuevo; § 7). Lista con vista previa;
  Aprobar / Corregir / Descartar. Aprobar cambia `estado: aprobado` y abre el chat con "Ejecuta la
  aprobación <ruta>"; Claude la ejecuta con los conectores. La app nunca envía nada sola.
- **Configuración**: skills activas (`.claude/skills/*/SKILL.md`: nombre y descripción) y biblioteca con
  "Activar" (= mover de `biblioteca/skills/...` a `.claude/skills/`); conectores (salida de `claude mcp list`,
  con link a claude.ai → Connectors); tareas programadas (link a `docs/tareas-programadas.md` y a
  claude.ai); avisos (locales: cuáles y cuándo); persona y carpeta del repo.

## 7. Cambios al repo que la app necesita

- `brief-del-dia`: escribir `## Propuestas` en cada entregable que lista (además de la bandeja).
- `brief-reunion`: agregar `link` (URL de la videollamada) al frontmatter cuando el evento lo trae.
- Nuevo tipo `aprobacion` en `esquemas.py`: obligatorios `persona, cliente, canal, estado`; `canal`:
  email, instagram, dm, ads, otro; `estado`: pendiente, aprobado, descartado, ejecutado. Las skills que
  hoy dejan borradores para aprobar los escriben como `bandeja/YYYY-MM-DD-aprobacion-<slug>.md`.
- `clientes/<c>/paginas/` y `clientes/<c>/adjuntos/` reconocidos (sin `tipo`; el validador los ignora).
- `CLAUDE.md`: regla de build de `ui-dist/`, `paginas/`, `adjuntos/`, `aprobacion`, y que la app existe.
- `.gitignore`: `app/node_modules/`, `app/out/` (builds del shell).

## 8. Instalación y actualización

- `pnpm --dir app dist` genera `agencia-os.app` (electron-builder, sin firmar). Se sube como release del
  repo privado; cada persona lo baja una vez. `/bienvenida` agrega el paso "instala la app" con el link.
- El marco casi no cambia; cuando cambie, se avisa en la app ("hay una versión nueva del marco") leyendo
  `app/package.json` del repo vs. la versión instalada, con link al release. Sin auto-update en v1.
- La interfaz se actualiza sola vía `ui-dist/` (§ 4).
- **Versión del puente**: el shell expone `shell.version` (entero que sube al agregar o cambiar funciones
  del puente) y `ui-dist/` declara `minShell` en su `manifest.json`. Si el shell instalado es menor, carga
  su UI empaquetada y muestra "Actualiza el marco para ver la última versión" con el link al release.

## 9. Lo que queda al constructor

- Estructura interna de componentes, estado y estilos (siguiendo el norte de diseño y `/emil-design-eng`).
- Cómo traducir eventos de stream-json a pasos humanos (empezar por Read/Edit/Write/Skill/Bash).
- Casilla de "listo" en la barra de menú: mi propuesta es avanzar al siguiente estado (brief → en_curso →
  revision); el constructor puede elegir otra regla clara y documentarla.
- Pruebas: Vitest para el modelo de datos (parseo, índice, fidelidad ida y vuelta del markdown, filtros,
  reglas de Hoy) y para el sync (cola, conflicto); una prueba de humo que arranca Electron con un repo de
  ejemplo (`tests/fixtures/repo` sirve de base).
- Orden sugerido de construcción: shell + datos + sync → Hoy + panel → Tablero → Cliente + editor →
  Chat → Barra de menú + avisos → Calendario, Aprobaciones, Configuración.
