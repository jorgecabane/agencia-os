# App de escritorio agencia-os — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app de Mac (ventana + barra de menú) que muestra y edita el repo agencia-os: Hoy con propuestas, Tablero, Cliente tipo Notion, chat con Claude en vivo, Calendario, Aprobaciones y Configuración.

**Architecture:** Electron. El proceso principal (`app/shell/`) hace archivos, git/sync, `claude` CLI, bandeja de menú y avisos, y expone un puente tipado `window.aos`. La interfaz React (`app/ui/`) se compila a `app/ui-dist/` (commiteado) y el shell la carga desde el repo, así que las mejoras de UI llegan por git. La UI arma en memoria un índice de los `.md`; no hay base de datos.

**Tech Stack:** Electron, React, TypeScript (strict), Vite, Vitest, Milkdown Crepe, `yaml`, `node-diff3`, electron-builder, pnpm. Python existente (pytest) para los cambios del repo.

**Spec:** `docs/superpowers/specs/2026-10-27-app-escritorio-design.md` (bocetos en `docs/superpowers/specs/mockups-app/`).

## Global Constraints

- Solo macOS. Gestor `pnpm`; todos los comandos de la app con `pnpm --dir app <script>`.
- Versiones: la última estable de cada paquete al instalar, **fijada exacta** en `app/package.json` (sin `^`).
- TypeScript `strict`. Tipos del puente en un solo archivo: `app/shared/puente.ts`.
- Textos de la interfaz en español de Chile (tú, nunca voseo), en minúscula de oración, sin jerga técnica.
- Norte de diseño `mockups-app/tablero-v2.html`. Tokens exactos: fondo `#242322`, lateral `#1f1e1d`, superficie `#2b2a28`, elevado `#343230`, línea `#3f3d39`, línea suave `#36342f`, texto `#ece9e2`, apagado `#a39f96`, tenue `#7c786f`, foco `#a7b0ff`, avance `#8fc79a`, atraso `#e58b7b`, `--ease-out: cubic-bezier(0.23,1,0.32,1)`. Títulos en Newsreader; UI en la fuente del sistema. Cargar `/emil-design-eng` y `frontend-design` antes de escribir componentes.
- Accesibilidad: foco visible 2px con `#a7b0ff`, estados con ícono + texto (nunca solo color), `prefers-reduced-motion` respetado, sin animación en acciones de teclado.
- La app no guarda nada fuera del repo salvo `~/Library/Application Support/agencia-os/config.json` (carpeta del repo, último commit visto, session ids de chat, preferencias de avisos).
- La app nunca envía ni publica nada hacia afuera. Borrar solo por acción explícita del usuario en la UI.
- Mensajes de commit de la app: `app: <persona> <YYYY-MM-DDTHH:MMZ>`; deshacer: `app: deshacer <persona>`.
- Si se toca `app/ui/`, correr `pnpm --dir app build:ui` y commitear `app/ui-dist/` en el mismo commit.
- `SHELL_VERSION = 1` en `app/shared/puente.ts`; `app/ui-dist/manifest.json` = `{"minShell": 1}`.

## Review Focus

1. Un `.md` con frontmatter roto o sin cerrar → la app no se cae; el ítem aparece marcado "no se pudo leer" y el resto carga (Task 4).
2. Primer arranque sin `AOS_PERSONA` en `.claude/settings.local.json` → la app pide elegir persona de `equipo/personas/` y la guarda; nunca muestra "Hoy" de nadie (Task 6).
3. Sin red o sin remoto → indicador "Sin conexión, reintento"; los cambios quedan commiteados localmente y suben solos después (Task 5).
4. El archivo abierto cambia por fuera mientras escribes → no se pierde lo escrito (mezcla de tres vías; si choca, quedan ambas versiones y un aviso) (Task 8).
5. `claude` no instalado o sin sesión → el chat explica cómo arreglarlo ("Instala Claude Code" / "Inicia sesión con `claude`") y el resto de la app funciona (Task 10).

---

### Task 1: Cambios del repo que la app necesita

**Files:**
- Modify: `.claude/hooks/sync.sh`, `scripts/aos/esquemas.py`, `.claude/skills/brief-del-dia/SKILL.md`, `.claude/skills/brief-reunion/SKILL.md`, `CLAUDE.md`, `.gitignore`
- Test: `tests/test_sync.py`, `tests/test_esquemas.py`

**Interfaces:**
- Produces: `sync.sh [mensaje]` con salida 0 (al día / nada que hacer), 3 (conflicto), 4 (sin conexión: fallo de pull o push sin conflicto). Tipo `aprobacion` en `ESQUEMAS`.

- [ ] **Step 1: Tests que fallan**

```python
# tests/test_sync.py
def test_mensaje_personalizado(tmp_path):
    remoto, a, _ = setup(tmp_path)
    (a / "f.txt").write_text("x\n")
    r = subprocess.run([str(SYNC), "app: jorge 2026-10-27T10:00Z"], capture_output=True, text=True,
                       env={**ENV, "CLAUDE_PROJECT_DIR": str(a)}, cwd=a)
    assert r.returncode == 0
    assert git(remoto, "log", "-1", "--format=%s").strip() == "app: jorge 2026-10-27T10:00Z"

def test_sin_red_sale_4(tmp_path):
    remoto, a, _ = setup(tmp_path)
    git(a, "remote", "set-url", "origin", str(tmp_path / "no-existe.git"))
    (a / "f.txt").write_text("x\n")
    assert sync(a).returncode == 4
```

```python
# tests/test_esquemas.py
def test_aprobacion():
    ok = {"tipo": "aprobacion", "persona": "jorge", "cliente": "acme", "canal": "email", "estado": "pendiente"}
    assert validar(ok) == []
    assert "'canal' debe ser uno de" in validar({**ok, "canal": "fax"})[0]
    assert "'estado' debe ser uno de" in validar({**ok, "estado": "listo"})[0]
```

- [ ] **Step 2:** `uv run pytest -q tests/test_sync.py tests/test_esquemas.py` → FAIL en los 3 nuevos.
- [ ] **Step 3: Implementar**
  - `sync.sh`: mensaje = `$1` o el actual `sesión: $persona $(date -u +%FT%RZ)`; fallo de pull sin conflicto y fallo de push → `exit 4` (mismo texto a stderr). El test existente `test_conflicto_no_rompe` sigue esperando 3.
  - `esquemas.py`: `"aprobacion": _esq(["persona","cliente","canal","estado"], {"canal": {"email","instagram","dm","ads","otro"}, "estado": {"pendiente","aprobado","descartado","ejecutado"}})`.
  - `brief-del-dia`: además de la bandeja, escribir en cada entregable listado una sección `## Propuestas` (reemplazarla si existe) con 2–3 viñetas `- <propuesta>`, la recomendada primero y terminada en ` (recomendada)`.
  - `brief-reunion`: agregar `link: "<url de la videollamada>"` al frontmatter cuando el evento lo trae.
  - `CLAUDE.md`: tabla "Dónde anotar qué" con `clientes/<c>/paginas/` (páginas libres, sin `tipo`), `clientes/<c>/adjuntos/` (imágenes ≤ 2 MB; más pesado, link a Drive) y `bandeja/YYYY-MM-DD-aprobacion-<slug>.md` (`tipo: aprobacion`: todo borrador hacia afuera se deja así); fila del tipo `aprobacion` en la tabla de frontmatter; regla de build de `ui-dist/`; una línea "La app de escritorio (`app/`) muestra y edita este repo".
  - `.gitignore`: `app/node_modules/`, `app/out/`, `app/dist/`.
- [ ] **Step 4:** `uv run pytest -q` → todo PASS; `uv run scripts/validar.py` → sin salida.
- [ ] **Step 5:** Commit `feat: repo listo para la app (sync con mensaje y salida 4, aprobacion, propuestas por entregable)`.

### Task 2: Esqueleto de la app y carga de la UI desde el repo

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/vitest.config.ts`, `app/electron-builder.yml`, `app/shared/puente.ts`, `app/shell/main.ts`, `app/shell/config.ts`, `app/shell/cargar-ui.ts`, `app/shell/preload.ts`, `app/ui/index.html`, `app/ui/main.tsx`, `app/ui/tokens.css`, `app/ui-dist/manifest.json`
- Test: `app/tests/cargar-ui.test.ts`, `app/tests/config.test.ts`

**Interfaces:**
- Produces:
  - `app/package.json` scripts: `dev`, `build:ui` (vite → `ui-dist/`, copia `manifest.json`), `build:shell` (tsc → `out/`), `dist` (electron-builder → `agencia-os.app`), `test` (vitest run).
  - `shared/puente.ts`: `export const SHELL_VERSION = 1` y `interface Puente` (se completa en tareas siguientes) expuesto como `window.aos`.
  - `elegirUI(repo: string | null, shellVersion: number): {origen: "repo" | "empaquetada", ruta: string, aviso?: string}`.
  - `leerConfig(): Config`, `guardarConfig(c: Partial<Config>): void`, con `interface Config { repo: string | null; ultimoVisto: string | null; sesiones: Record<string, string>; avisos: {reuniones: boolean; actas: boolean; dia: boolean} }` (ruta inyectable para tests).

- [ ] **Step 1: Tests**

```ts
// cargar-ui.test.ts
test("usa ui-dist del repo si el manifest lo permite", () => {
  const repo = fixtureRepo({ "app/ui-dist/index.html": "<html/>", "app/ui-dist/manifest.json": '{"minShell":1}' });
  expect(elegirUI(repo, 1)).toEqual({ origen: "repo", ruta: join(repo, "app/ui-dist/index.html") });
});
test("shell viejo → UI empaquetada con aviso", () => {
  const repo = fixtureRepo({ "app/ui-dist/index.html": "<html/>", "app/ui-dist/manifest.json": '{"minShell":2}' });
  const r = elegirUI(repo, 1);
  expect(r.origen).toBe("empaquetada");
  expect(r.aviso).toBe("Actualiza el marco para ver la última versión");
});
test("sin repo o sin ui-dist → empaquetada sin aviso", () => {
  expect(elegirUI(null, 1).origen).toBe("empaquetada");
});
// config.test.ts
test("config por defecto y guardado parcial", () => { /* repo null, avisos todos true; guardar {repo} conserva lo demás */ });
```

- [ ] **Step 2:** `pnpm --dir app test` → FAIL.
- [ ] **Step 3:** Implementar. `main.ts`: al iniciar, si `config.repo` es null, `dialog.showOpenDialog` para elegir carpeta (debe contener `CLAUDE.md`); carga la UI según `elegirUI`; vigila `app/ui-dist/` y recarga la ventana al cambiar. `contextIsolation: true`, `nodeIntegration: false`, sin cargar URLs remotas. `tokens.css` con los tokens de Global Constraints y Newsreader embebida (archivo de fuente en `ui/`, no Google Fonts en runtime).
- [ ] **Step 4:** `pnpm --dir app test` PASS; `pnpm --dir app build:ui && pnpm --dir app build:shell` sin errores; `pnpm --dir app dev` abre una ventana con el fondo `#242322`.
- [ ] **Step 5:** Commit (incluye `ui-dist/`) `feat(app): esqueleto Electron que carga la UI desde el repo`.

### Task 3: Puente de archivos y vigilancia

**Files:**
- Create: `app/shell/repo.ts`
- Modify: `app/shared/puente.ts`, `app/shell/preload.ts`, `app/shell/main.ts`
- Test: `app/tests/repo.test.ts`

**Interfaces:**
- Produces en `Puente`: `repo.list(glob: string): Promise<string[]>` (rutas relativas, ignora `.git`, `node_modules`, `ui-dist`), `repo.read(ruta): Promise<string>`, `repo.write(ruta, contenido): Promise<void>` (atómico: tmp + rename; crea carpetas), `repo.move(de, a)`, `repo.delete(ruta)`, `repo.onCambio(cb: (rutas: string[]) => void): () => void` (eventos agrupados cada 150 ms). Todas rechazan rutas fuera del repo (`..`, absolutas).

- [ ] **Step 1: Tests:** escritura atómica deja el contenido exacto; `write("../x")` y `write("/etc/x")` lanzan `Error("ruta fuera del repo")`; `list("clientes/**/*.md")` sobre `tests/fixtures/repo` devuelve las fichas de acme y beta; dos escrituras seguidas producen un solo evento agrupado con ambas rutas.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar con `fs/promises`, `fast-glob` y `chokidar` (o `fs.watch` recursivo de macOS). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(app): puente de archivos del repo`.

### Task 4: Modelo de datos (índice en memoria)

**Files:**
- Create: `app/ui/datos/md.ts`, `app/ui/datos/indice.ts`, `app/ui/datos/promesas.ts`, `app/ui/datos/tipos.ts`
- Test: `app/tests/md.test.ts`, `app/tests/indice.test.ts`, `app/tests/promesas.test.ts`

**Interfaces:**
- Produces:
  - `separar(texto: string): {fm: string | null; meta: Record<string, unknown> | null; cuerpo: string; error?: string}` y `unir(fmOriginal: string | null, cambios: Record<string, unknown>, cuerpo: string): string` (edita solo las claves cambiadas con `yaml` Document API, conserva orden y comentarios).
  - `tipos.ts`: `Cliente, Entregable, Reunion, Decision, Persona, Aprobacion, Promesa`, cada uno con `ruta: string` y los campos de `scripts/aos/esquemas.py`.
  - `construirIndice(archivos: Map<string, string>): Indice` y `actualizarIndice(i: Indice, cambios: Map<string, string | null>): Indice`. `Indice = {clientes, entregables, reuniones, decisiones, personas, aprobaciones, rotos: {ruta, error}[]}`.
  - `promesasDeActa(acta: Reunion, cuerpo: string, slugsEquipo: Set<string>): Promesa[]` con `Promesa = {quien, que, fecha: string | null, hecha: boolean, delCliente: boolean, acta: string}`; líneas `- [ ] <quien>: <qué> (<YYYY-MM-DD|sin fecha>)` bajo `## Promesas`; `delCliente` = `quien` no está en `slugsEquipo`.

- [ ] **Step 1: Tests:** `unir(fm, {vence: "2026-10-30"}, cuerpo)` cambia solo esa línea y conserva un comentario `# x` del frontmatter; `separar` de un archivo sin cerrar `---` devuelve `error` y el índice lo pone en `rotos` sin lanzar (Review Focus 1); el índice de `tests/fixtures/repo` tiene 2 clientes y los entregables de acme; `promesasDeActa` separa `jorge` (equipo) de `ana` (cliente) y lee `(sin fecha)` como `null`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): índice en memoria del repo`.

### Task 5: Sync en el shell

**Files:**
- Create: `app/shell/sync.ts`, `app/shell/git.ts`
- Modify: `app/shared/puente.ts`, `app/shell/main.ts`
- Test: `app/tests/sync.test.ts`

**Interfaces:**
- Consumes: `sync.sh [mensaje]` con salidas 0/3/4 (Task 1).
- Produces en `Puente`: `sync.estado(): Estado` y `sync.onEstado(cb)` con `Estado = "al-dia" | "subiendo" | "sin-conexion" | "conflicto"`; `sync.ahora()`; `sync.pausar(): () => void` (devuelve reanudar; usado por el chat); `git.log(opts: {desde?: string; ruta?: string; max?: number}): Promise<Commit[]>` con `Commit = {hash, autor, email, fecha, mensaje, rutas: string[]}`; `git.show(hash, ruta): Promise<string>`.
- `crearSync({correr, ahora, persona}): Sync`: cola de una ejecución a la vez; disparadores `escribio()` (5 s de calma), intervalo 45 s, `foco()`. En pausa no corre; al reanudar corre una vez.

- [ ] **Step 1: Tests (reloj falso, `correr` falso que devuelve el código):** dos `escribio()` dentro de 5 s → una sola ejecución; código 4 → estado `sin-conexion` y reintento en el siguiente ciclo (Review Focus 3); código 3 → `conflicto` y no reintenta solo hasta `sync.ahora()`; en pausa no corre y al reanudar corre una vez; mensaje pasado = `app: <persona> <YYYY-MM-DDTHH:MMZ>`. Una prueba de integración con repos git temporales reusando `.claude/hooks/sync.sh` sube un cambio.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): sync casi en tiempo real`.

### Task 6: Lateral, persona y "Hoy" con panel

**Files:**
- Create: `app/ui/App.tsx`, `app/ui/componentes/Lateral.tsx`, `app/ui/componentes/IndicadorSync.tsx`, `app/ui/componentes/ElegirPersona.tsx`, `app/ui/componentes/Panel.tsx`, `app/ui/pantallas/Hoy.tsx`, `app/ui/datos/hoy.ts`, `app/ui/datos/novedades.ts`, `app/ui/datos/propuestas.ts`
- Modify: `app/shared/puente.ts` (`persona(): Promise<string | null>`, `guardarPersona(slug)` que escribe `env.AOS_PERSONA` en `.claude/settings.local.json`)
- Test: `app/tests/hoy.test.ts`, `app/tests/propuestas.test.ts`, `app/tests/novedades.test.ts`

**Interfaces:**
- Produces: `hoy(i: Indice, persona: string, fecha: string): {reuniones: Reunion[]; entregas: Entregable[]; tentativas: Entregable[]; debeCliente: Promesa[]}`; `propuestas(cuerpo: string): {texto: string; recomendada: boolean}[]` (sección `## Propuestas`); `novedades(commits: Commit[], yo: string): string[]` (frases "Jorge movió el carrusel al 30", agrupadas, sin commits propios). `<Panel ruta onCerrar>` reutilizable (Tablero, Calendario, Cliente lo usan): etiquetas, contexto, propuestas, inspiración, acciones Desarrollar/Editar/Reagendar/Asignar/Borrar, y un hueco `chat` (lo llena Task 10).

- [ ] **Step 1: Tests:** `hoy` incluye solo `responsable === persona`, no `publicado`/`cancelado`, vence ≤ fecha (atrasados primero), tentativas aparte, reuniones con `fecha` del día y la persona en `asistentes`, y `debeCliente` solo de clientes donde la persona es `responsable`; `propuestas` marca la que termina en `(recomendada)`; `novedades` omite los commits de `yo`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. UI según `mockups-app/hoy.html` con los tokens. Sin persona → `ElegirPersona` (Review Focus 2). Reagendar escribe `vence` con `unir`; Asignar, `responsable`; Borrar pide confirmar.
- [ ] **Step 5:** `build:ui`; commit `feat(app): Hoy con propuestas y panel`.

### Task 7: Tablero con filtros

**Files:**
- Create: `app/ui/pantallas/Tablero.tsx`, `app/ui/componentes/Filtros.tsx`, `app/ui/datos/filtros.ts`, `app/ui/datos/actividad.ts`, `app/ui/datos/vistas.ts`
- Test: `app/tests/filtros.test.ts`, `app/tests/actividad.test.ts`, `app/tests/vistas.test.ts`

**Interfaces:**
- Produces: `type Filtro = {personas?: string[]; clientes?: string[]; formatos?: string[]; estados?: string[]; vence?: "hoy" | "semana" | "atrasado" | "todo"; esperandoCliente?: boolean}`; `aplicar(es: Entregable[], f: Filtro, hoy: string): Entregable[]`; `conteos(es, campo): Record<string, number>`; `actividad(ultimo: Commit | undefined, hoy: Date): {tipo: "avanzo" | "quieta" | "sin-abrir"; texto: string}` (quieta = sin commits hace ≥ 3 días); vistas en `app/vistas.json` = `{nombre: string; filtro: Filtro; agrupar: "estado" | "persona"}[]`, con las 4 por defecto (Esta semana, Todo, Atrasado, Esperando al cliente).

- [ ] **Step 1: Tests:** filtros combinados (persona + cliente + semana); `conteos` por cliente; `actividad` con commit de hace 4 días → `{tipo:"quieta", texto:"Quieta hace 4 días"}`; `vistas.json` ausente → las 4 por defecto.
- [ ] **Step 2–4:** FAIL → implementar → PASS. UI según `tablero-v2.html`: columnas por estado (cancelado oculto), arrastrar cambia `estado`, agrupar por persona, caras como filtro, chips con ×, menú "Filtrar" con tecla F, buscador y conteos; clic abre `<Panel>`.
- [ ] **Step 5:** `build:ui`; commit `feat(app): tablero del equipo`.

### Task 8: Editor tipo Notion

**Files:**
- Create: `app/ui/componentes/Editor.tsx`, `app/ui/datos/markdown.ts`, `app/ui/datos/mezcla.ts`
- Test: `app/tests/markdown.test.ts`, `app/tests/mezcla.test.ts`

**Interfaces:**
- Produces: `<Editor ruta>` (Milkdown Crepe; frontmatter como etiquetas editables arriba vía `unir`; "/" con título, tabla, lista de tareas, imagen, pedirle a Claude; guardado 1 s tras dejar de escribir); `serializar(md: string): string` (round-trip con remark configurado: listas con `-`, `[[...]]` sin escapar, tablas GFM); `mezclar(base: string, mio: string, afuera: string): {texto: string; conflicto: boolean}` (con `node-diff3`; en conflicto deja ambas versiones del bloque, la mía primero). Imágenes pegadas ≤ 2 MB → `clientes/<c>/adjuntos/<fecha>-<slug>.<ext>`; más grandes → aviso "Súbela a Drive y pega el link".

- [ ] **Step 1: Tests:** `serializar` conserva `[[clientes/acme/_ficha]]`, `- [ ] jorge: algo (2026-10-30)` y una tabla de 3 columnas; abrir sin editar no escribe (el componente no llama `repo.write` si el contenido no cambió); `mezclar` con cambios en párrafos distintos los une sin conflicto; en el mismo párrafo → `conflicto: true` y ambas versiones presentes (Review Focus 4).
- [ ] **Step 2–4:** FAIL → implementar → PASS. Cambio externo con edición pendiente: no recargar; al guardar, `mezclar(base, mío, actual en disco)`; si `conflicto`, aviso "Cambió mientras editabas: revisa" con botón "Pedirle a Claude que lo mezcle".
- [ ] **Step 5:** `build:ui`; commit `feat(app): editor tipo Notion con mezcla segura`.

### Task 9: Página de cliente

**Files:**
- Create: `app/ui/pantallas/Cliente.tsx`, `app/ui/datos/resumen.ts`, `app/ui/componentes/Historial.tsx`
- Test: `app/tests/resumen.test.ts`

**Interfaces:**
- Consumes: `<Editor>`, `<Panel>`, `git.log({ruta})`, `git.show`.
- Produces: `resumen(i: Indice, cliente: string, hoy: string): {proxima?: Reunion; abiertos: Entregable[]; debe: Promesa[]; aprendimos: string[]; linea: string[]}` (`aprendimos` = viñetas de `contexto.md › ## Lo que aprendimos`; `linea` = últimas 10 líneas de `linea-de-tiempo.md`, más reciente primero).

- [ ] **Step 1: Tests:** `resumen` de acme: próxima reunión = el brief futuro más cercano; abiertos sin publicados/cancelados ordenados por vence; línea de tiempo invertida y cortada en 10.
- [ ] **Step 2–4:** FAIL → implementar → PASS. UI según `cliente.html` y `cliente-editor.html`: cabecera; Resumen (marcado "automático", solo lectura; "Esta semana" se oculta si no hay `metricas/`); pestañas lista (Entregables, Reuniones, Decisiones → abren con `<Editor>`); pestañas documento (Contexto, Brandbook, Plan, Material y cada `.md` de `paginas/`); "+" crea `paginas/<slug>.md`, una vista de tareas del cliente (guardada en `app/vistas.json`) o abre el chat con "Créame una pestaña de …"; historial: lista de commits del archivo, ver versión, "Restaurar".
- [ ] **Step 5:** `build:ui`; commit `feat(app): página de cliente`.

### Task 10: Chat con Claude en vivo

**Files:**
- Create: `app/shell/claude.ts`, `app/ui/componentes/Chat.tsx`, `app/ui/datos/pasos.ts`, `app/ui/datos/deshacer.ts`
- Modify: `app/shared/puente.ts`, `app/ui/componentes/Panel.tsx` (llena el hueco del chat), `app/ui/App.tsx` (⌘J)
- Test: `app/tests/claude-args.test.ts`, `app/tests/pasos.test.ts`, `app/tests/deshacer.test.ts`

**Interfaces:**
- Produces:
  - `argsClaude({mensaje, contexto, sesion, envio}: {mensaje: string; contexto: string; sesion?: string; envio?: string[]}): string[]` → `["-p", "<Estás viendo <contexto>. Persona: <slug>.>\n\n<mensaje>", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--allowedTools", <lista>, ...(sesion ? ["--resume", sesion] : [])]`. Lista base: `Read Edit Write Glob Grep Skill Bash(uv run *) Bash(git *) Bash(pnpm --dir app *)` + herramientas de lectura de conectores (`mcp__claude_ai_*` cuyo nombre empieza con `list`, `get`, `search`, `read`, `fetch`); `envio` agrega herramientas solo en el turno de "Ejecuta la aprobación".
  - `Puente.claude.enviar(contextoId, mensaje, contexto, envio?) → onEvento(cb)`, `claude.cancelar(contextoId)`; el shell corre `claude` con `cwd` = repo y `AOS_PERSONA`, pausa el sync durante el turno (`sync.pausar()`), guarda el `session_id` por `contextoId` en el config.
  - `paso(evento): {texto: string; estado: "ok" | "corriendo" | "error"} | null` (Read de `brandbook.md` → "Leí el brandbook"; Skill `ig-carousel` → "Usando ig-carousel"; Edit/Write → "Edité <título>"; denegado → "No tengo permiso para <herramienta>").
  - `archivosADeshacer(eventos): string[]` (rutas de Edit/Write del turno, sin `linea-de-tiempo.md` ni `sesiones/`); deshacer = `git.show(commitPrevio, ruta)` → `repo.write`, o borrar si no existía; commit `app: deshacer <persona>`.

- [ ] **Step 1: Tests:** `argsClaude` sin sesión no lleva `--resume` y con `envio` agrega esas herramientas; `paso` traduce los 4 casos; `archivosADeshacer` excluye `clientes/acme/linea-de-tiempo.md` y `sesiones/x.md`; `claude` no encontrado (ENOENT) → evento `{tipo:"error", texto:"Instala Claude Code para conversar aquí"}` y salida "not logged in" → "Inicia sesión con `claude` en la terminal" (Review Focus 5).
- [ ] **Step 2–4:** FAIL → implementar → PASS. UI según `chat.html`: etiqueta de contexto, pasos, texto, tarjetas de aprobación (cuando Claude crea un `bandeja/*aprobacion*`), recetas por contexto, barra "Aceptar / Deshacer todo" con lo nuevo marcado en el documento abierto.
- [ ] **Step 5:** `build:ui`; commit `feat(app): chat con Claude en contexto`.

### Task 11: Barra de menú, avisos y captura rápida

**Files:**
- Create: `app/shell/bandeja-menu.ts`, `app/shell/avisos.ts`, `app/ui/barra/Barra.tsx`, `app/ui/datos/agenda.ts`
- Test: `app/tests/agenda.test.ts`

**Interfaces:**
- Produces: `agenda(i: Indice, persona: string, ahora: Date): {proxima?: Reunion; masTarde: Reunion[]; entregas: Entregable[]; pendientes: number; atrasado: boolean}`; `avisosPendientes(i, persona, ahora, yaAvisados: Set<string>): {id: string; titulo: string; texto: string; ruta: string}[]` (reunión en ≤ 10 min, acta nueva donde soy asistente, bandeja de hoy aparecida); `siguienteEstado(e): string` (brief → en_curso → revision → aprobado; publicado queda).
- Ventana de la barra: `BrowserWindow` sin marco bajo el ícono, carga `ui-dist/index.html#barra`. Atajo global ⌥Espacio → captura rápida que manda el texto al chat con contexto "Todo el espacio". ⌘O abre la ventana principal. "Pausar avisos 1 h".

- [ ] **Step 1: Tests:** `agenda` a las 16:52 con reunión 17:00 → `proxima` y texto "En 8 minutos" (función `cuentaRegresiva`); `avisosPendientes` no repite ids ya avisados; acta nueva de otra persona sin mí en `asistentes` → sin aviso; `siguienteEstado` de `revision` → `aprobado`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. UI según `barra.html`. "Unirme" abre `link` del brief con `shell.openExternal` (solo `https:`).
- [ ] **Step 5:** `build:ui`; commit `feat(app): barra de menú y avisos`.

### Task 12: Calendario, Aprobaciones y Configuración

**Files:**
- Create: `app/ui/pantallas/Calendario.tsx`, `app/ui/pantallas/Aprobaciones.tsx`, `app/ui/pantallas/Config.tsx`, `app/ui/datos/calendario.ts`, `app/ui/datos/skills.ts`, `app/shell/sistema.ts`
- Test: `app/tests/calendario.test.ts`, `app/tests/skills.test.ts`

**Interfaces:**
- Produces: `semanas(i: Indice, mes: string, f: Filtro): {dia: string; items: (Entregable | Reunion)[]}[][]` (lunes primero); `skills(archivos): {nombre: string; descripcion: string; activa: boolean; ruta: string}[]` (de `.claude/skills/*/SKILL.md` y `biblioteca/skills/**/SKILL.md`); activar = `repo.move` de la carpeta a `.claude/skills/`. `Puente.sistema.conectores(): Promise<string>` (salida de `claude mcp list`).
- Calendario: mes y semana, color por cliente, filtros del Tablero (`<Filtros>`), arrastrar cambia `vence` (nunca `recurrencia_fecha`), clic abre `<Panel>`. Aprobaciones: `tipo: aprobacion` con `estado: pendiente`; Aprobar → `estado: aprobado` + chat "Ejecuta la aprobación <ruta>" con `envio` del canal; Corregir → chat con el borrador; Descartar → `estado: descartado`. Configuración: skills (activas/biblioteca + Activar), conectores (texto + botón "Abrir claude.ai → Connectors"), tareas programadas (links), avisos (interruptores en config local), persona y carpeta del repo.

- [ ] **Step 1: Tests:** `semanas` de octubre 2026 empieza en lunes 28 de septiembre y pone un entregable con `vence: 2026-10-30` el viernes; mover en calendario cambia `vence` y deja `recurrencia_fecha` igual; `skills` marca `ig-carousel` activa y `pricing` de biblioteca inactiva.
- [ ] **Step 2–4:** FAIL → implementar → PASS, con el mismo norte de diseño.
- [ ] **Step 5:** `build:ui`; commit `feat(app): calendario, aprobaciones y configuración`.

### Task 13: Empaquetado y onboarding

**Files:**
- Modify: `app/electron-builder.yml`, `.claude/skills/bienvenida/SKILL.md`, `docs/conectores.md`
- Create: `docs/app.md`

- [ ] **Step 1:** `pnpm --dir app dist` genera `app/dist/agencia-os.app` (arm64, sin firmar). Abrirla con un repo de prueba: carga Hoy, la barra de menú aparece, el sync muestra "Al día".
- [ ] **Step 2:** `docs/app.md`: cómo instalar (bajar el release, clic derecho → Abrir), cómo se actualiza la UI (sola) y el marco (aviso + release), cómo mejorar la UI (editar `app/ui/`, `build:ui`, commit). `/bienvenida`: paso "Instala la app" con el link al release y elegir la carpeta del repo; para quien no usa terminal, la app reemplaza la pestaña Code para el día a día.
- [ ] **Step 3:** `pnpm --dir app test` y `uv run pytest -q` PASS.
- [ ] **Step 4:** Commit `feat(app): empaquetado y onboarding`. Crear el release en GitHub (`gh release create app-v1 app/dist/agencia-os.zip --repo jorgecabane/agencia-os`) solo con confirmación del dueño del espacio.
