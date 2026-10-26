# agencia-os · Fase 1 (base + piloto Donna's) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repo `agencia-os` operativo para la agencia: estructura de datos tipo CRM en markdown, reglas de operación para Claude, hooks que validan y sincronizan, vistas en Obsidian, onboarding, ingesta automática de reuniones/correo/calendario, briefs, recurrentes, y Donna's cargado como piloto.

**Architecture:** El repo git es la única fuente de verdad (markdown + frontmatter YAML). Lo determinista (validar esquemas, reconocer cliente por email, materializar recurrentes, sincronizar git) son scripts Python chicos con tests; lo que requiere juicio (actas, briefs, propuestas) son skills de Claude Code que llaman a esos scripts. Las tareas periódicas son tareas programadas en la nube de Claude Code (`/schedule`) que clonan el repo, corren una skill y hacen push a `main`.

**Tech Stack:** Python ≥3.12 vía `uv` (deps: `pyyaml`; dev: `pytest`), bash, git + GitHub (`gh`), Claude Code (skills, hooks, `.mcp.json`, `/schedule`), Obsidian ≥1.14 (Bases) + plugins comunitarios.

**Spec:** `docs/superpowers/specs/2026-10-23-agencia-os-design.md`

## Global Constraints

- Un solo repo. Datos de la agencia SOLO en `marca/`, `clientes/`, `equipo/`, `sesiones/`, `bandeja/`. Nada en `.claude/`, `scripts/`, `plantillas/`, `vistas/`, `.obsidian/`, `docs/` nombra a un cliente, persona o a la marca (spec §6.1).
- Ningún archivo pesado (video, foto original) en el repo; solo links a Drive.
- Ninguna credencial en el repo. `.mcp.json` solo definiciones; tokens quedan locales/en la nube.
- Todo cambio del agente es un commit. Hacia afuera (correos a clientes, publicar, DMs, ads) solo borradores; nunca se envía (spec §9). Excepción: conectores de cliente (ClickUp) escriben solo — fase 2.
- Privacidad (spec §9.1): solo se procesa lo que involucra a un email/dominio registrado de un cliente o prospecto; lo demás no se escribe en ninguna parte.
- Nombres de archivo con fecha: `YYYY-MM-DD-<slug>.md`; slug en minúsculas, sin tildes, guiones.
- Valores de enums (exactos): `etapa`: prospecto | propuesta | activo | pausado | cerrado · `modalidad`: retainer | proyecto | mixto · `estado`: brief | en_curso | revision | aprobado | publicado | cancelado · días `cada`: lun mar mie jue vie sab dom.
- Responsable `ia` es válido como responsable de entregables.
- Todo texto para el usuario en español de Chile (tú, nunca voseo).
- Tareas programadas: intervalo mínimo 1 h; cron en UTC; usar minuto :07, no :00.

## Review Focus

1. Alguien arrastra en el calendario un entregable recurrente a otro día → la siguiente materialización NO crea un duplicado en la fecha original (clave = `recurrencia_fecha`, no `vence`).
2. Obsidian reescribe el frontmatter (fechas sin comillas → YAML las parsea como `date`; wikilinks entre comillas; listas en bloque) → el validador acepta tanto `date` como string ISO, y round-trip no rompe wikilinks.
3. Dos personas sincronizan cambios en conflicto → el sync no deja el repo a medio rebase ni pierde el commit local; avisa y sale 0.
4. Correo/reunión con solo dominios genéricos (gmail.com) o personas sin ficha → `cliente_para` devuelve `None` y nada se escribe.
5. Cambia una regla recurrente mientras hay instancias `en_curso` → esas no se tocan; solo se eliminan/crean instancias futuras en `brief`.
6. Nombres con tildes/ñ/apóstrofe ("Donna's", "Clima Simple", "Campaña Año Nuevo") → slugs estables (`donnas`, `clima-simple`, `campana-ano-nuevo`).

---

## Estructura de archivos

```
pyproject.toml                       # uv, deps, pytest pythonpath=scripts
CLAUDE.md                            # reglas de operación (postura jefe de proyecto)
.gitignore                           # ya existe; agregar .obsidian/workspace*.json, .venv/
.mcp.json                            # MCPs de proyecto (vacío en fase 1 salvo verificados)
.claude/settings.json                # hooks Stop + SessionEnd
.claude/hooks/stop.py                # bloquea si falta bitácora o frontmatter inválido
.claude/hooks/sync.sh                # commit + pull --rebase + push
.claude/skills/<nombre>/SKILL.md     # una por skill (ver Tasks 6-10)
scripts/aos/__init__.py
scripts/aos/fm.py                    # leer/escribir frontmatter
scripts/aos/slug.py                  # slugify
scripts/aos/esquemas.py              # ESQUEMAS + validar()
scripts/aos/clientes.py              # cargar fichas + cliente_para(emails)
scripts/aos/recurrentes.py           # materializar()
scripts/validar.py                   # CLI
scripts/cliente.py                   # CLI: match de emails
scripts/materializar.py              # CLI
plantillas/cliente/                  # esqueleto de carpeta de cliente
vistas/*.base                        # vistas Obsidian
.obsidian/                           # config + plugins comprometidos
tests/test_*.py
tests/fixtures/                      # repo de ejemplo con cliente ficticio "acme"
```

Los datos reales (`clientes/donna/`, `equipo/personas/…`, `marca/`) se crean recién en Tasks 10–11 vía skills.

---

### Task 1: Base Python — frontmatter y slug

**Files:**
- Create: `pyproject.toml`, `scripts/aos/__init__.py`, `scripts/aos/fm.py`, `scripts/aos/slug.py`
- Test: `tests/test_fm.py`, `tests/test_slug.py`

**Interfaces:**
- Produces:
  - `slug(texto: str) -> str`
  - `leer(path: Path) -> tuple[dict, str]` — `({}, texto)` si no hay frontmatter
  - `escribir(path: Path, meta: dict, cuerpo: str) -> None` — crea dirs padres; YAML con `allow_unicode=True, sort_keys=False`

- [ ] **Step 1: `pyproject.toml`**: `requires-python = ">=3.12"`, `dependencies = ["pyyaml>=6"]`, `[dependency-groups] dev = ["pytest>=8"]`, `[tool.uv] package = false`, `[tool.pytest.ini_options] pythonpath = ["scripts"]`. Run `uv sync` → OK.
- [ ] **Step 2: Tests que fallan**

```python
def test_slug_tildes_y_apostrofes():
    assert slug("Donna's") == "donnas"
    assert slug("Clima Simple") == "clima-simple"
    assert slug("Campaña Año Nuevo") == "campana-ano-nuevo"
    assert slug("  Post  feed / IG ") == "post-feed-ig"

def test_roundtrip_preserva_wikilink_y_fecha(tmp_path):
    p = tmp_path / "a" / "x.md"
    escribir(p, {"tipo": "entregable", "vence": date(2026, 10, 30), "origen": "[[reu-1]]"}, "## Brief\nhola\n")
    meta, cuerpo = leer(p)
    assert meta["vence"] == date(2026, 10, 30)
    assert meta["origen"] == "[[reu-1]]"
    assert cuerpo == "## Brief\nhola\n"

def test_leer_sin_frontmatter(tmp_path):
    p = tmp_path / "c.md"; p.write_text("# Contexto\n")
    assert leer(p) == ({}, "# Contexto\n")
```

- [ ] **Step 3:** `uv run pytest tests/test_fm.py tests/test_slug.py -v` → FAIL (import error).
- [ ] **Step 4: Implementar.** `slug`: `unicodedata.normalize("NFKD")`, quitar combinantes, quitar apóstrofes, no-alfanumérico → `-`, colapsar y recortar guiones. `leer`: el frontmatter es el bloque entre `---\n` inicial y la siguiente línea `---`; `yaml.safe_load`.
- [ ] **Step 5:** tests → PASS.
- [ ] **Step 6: Commit** `feat: frontmatter y slug`.

---

### Task 2: Esquemas y validador

**Files:**
- Create: `scripts/aos/esquemas.py`, `scripts/validar.py`
- Test: `tests/test_esquemas.py`

**Interfaces:**
- Consumes: `leer` (Task 1)
- Produces:
  - `ESQUEMAS: dict[str, dict]` — por `tipo`: `requeridos: list[str]`, `enums: dict[str, set[str]]`, `fechas: list[str]`
  - `validar(meta: dict) -> list[str]` — lista de errores legibles en español; `[]` si ok; meta sin `tipo` → `[]`
  - CLI `uv run scripts/validar.py [rutas...]` — sin rutas valida todos los `.md` bajo `clientes/ equipo/ sesiones/ bandeja/`; imprime `ruta: error` y sale 1 si hay errores, 0 si no.

Esquemas (exactos, spec §7):

| tipo | requeridos | enums | fechas |
|---|---|---|---|
| cliente | nombre, slug, etapa, modalidad, responsable | etapa, modalidad | proximo_contacto |
| plan | cliente | — | vigente_desde |
| entregable | cliente, formato, vence, estado, responsable | estado | vence, recurrencia_fecha |
| reunion | cliente, fecha | — | fecha |
| brief-reunion | cliente, fecha | — | fecha |
| decision | cliente, fecha | — | fecha |
| sesion | persona, fecha, session_id, clientes | — | fecha |
| persona | nombre, slug, rol, nivel_automatizacion | nivel_automatizacion: alto/medio/bajo | — |

Para `plan`, además: cada ítem de `recurrentes` requiere `nombre, formato, cada, responsable`; `cada` es string o lista con valores en {lun…dom}.

- [ ] **Step 1: Tests que fallan**

```python
def test_entregable_valido():
    assert validar({"tipo":"entregable","cliente":"acme","formato":"post-instagram",
                    "vence":date(2026,10,30),"estado":"brief","responsable":"ia"}) == []

def test_fecha_como_string_iso_es_valida():
    assert validar({"tipo":"decision","cliente":"acme","fecha":"2026-10-22"}) == []

def test_errores_legibles():
    errs = validar({"tipo":"entregable","cliente":"acme","formato":"x","vence":"mañana","estado":"listo"})
    assert "falta 'responsable'" in errs
    assert "'estado' debe ser uno de: aprobado, brief, cancelado, en_curso, publicado, revision" in errs
    assert "'vence' no es fecha (YYYY-MM-DD)" in errs

def test_tipo_desconocido():
    assert validar({"tipo":"cosa"}) == ["tipo desconocido 'cosa'"]

def test_plan_recurrente_dia_invalido():
    errs = validar({"tipo":"plan","cliente":"acme","recurrentes":[
        {"nombre":"Post","formato":"post-instagram","cada":["martes"],"responsable":"ia"}]})
    assert errs == ["recurrentes[0].cada: 'martes' no es día (lun mar mie jue vie sab dom)"]

def test_cli_sale_1_con_errores(tmp_path): ...  # subprocess sobre un .md inválido → returncode 1 y "falta" en stdout
```

Fechas aceptan `date`, `datetime` o string que `date.fromisoformat`/`datetime.fromisoformat` acepte.

- [ ] **Step 2:** run → FAIL. **Step 3:** implementar. **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: esquemas y validador`.

---

### Task 3: Reconocer cliente por email (filtro de privacidad)

**Files:**
- Create: `scripts/aos/clientes.py`, `scripts/cliente.py`, `tests/fixtures/repo/clientes/acme/_ficha.md`, `tests/fixtures/repo/clientes/beta/_ficha.md`
- Test: `tests/test_clientes.py`

**Interfaces:**
- Consumes: `leer`
- Produces:
  - `DOMINIOS_GENERICOS: frozenset[str]` = gmail.com, googlemail.com, hotmail.com, outlook.com, live.com, yahoo.com, icloud.com, me.com, proton.me, protonmail.com
  - `cargar_clientes(raiz: Path) -> list[dict]` — metas de `clientes/*/_ficha.md`
  - `cliente_para(emails: list[str], clientes: list[dict], internos: set[str] = frozenset()) -> str | None` — slug del cliente
  - CLI `uv run scripts/cliente.py a@x.cl b@y.cl` → imprime slug o `ninguno` (exit 0 en ambos)

Regla: se ignoran emails internos (dominio de la agencia, pasados en `internos`). Un email calza con un cliente si su dominio está en `dominios_email` (salvo dominios genéricos) o el email exacto está en `emails` de la ficha. Si calzan 0 clientes → `None`. Si calzan ≥2 → `None` (ambiguo; la skill lo manda a la bandeja del dueño). Comparación en minúsculas.

Fixture `acme`: `dominios_email: [acme.cl]`, `emails: [dueño.acme@gmail.com]`; `beta`: `dominios_email: [beta.com]`.

- [ ] **Step 1: Tests que fallan**

```python
def test_por_dominio(): assert cliente_para(["Ana@ACME.cl"], C) == "acme"
def test_generico_no_calza_por_dominio(): assert cliente_para(["otro@gmail.com"], C) is None
def test_generico_calza_por_email_exacto(): assert cliente_para(["dueño.acme@gmail.com"], C) == "acme"
def test_internos_se_ignoran(): assert cliente_para(["jorge@agencia.cl","x@acme.cl"], C, {"agencia.cl"}) == "acme"
def test_ambiguo(): assert cliente_para(["a@acme.cl","b@beta.com"], C) is None
def test_nadie(): assert cliente_para(["jorge@agencia.cl"], C, {"agencia.cl"}) is None
```

- [ ] **Steps 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat: reconocer cliente por email`.

---

### Task 4: Materializar entregables recurrentes

**Files:**
- Create: `scripts/aos/recurrentes.py`, `scripts/materializar.py`
- Test: `tests/test_recurrentes.py`

**Interfaces:**
- Consumes: `leer`, `escribir`, `slug`
- Produces:
  - `@dataclass Cambios: creados: list[Path]; eliminados: list[Path]`
  - `materializar(carpeta_cliente: Path, hoy: date, semanas: int = 4) -> Cambios`
  - CLI `uv run scripts/materializar.py [--hoy YYYY-MM-DD]` — corre sobre cada `clientes/*/` con `plan-contratado.md`; imprime resumen `cliente: +N -M`.

Algoritmo:
- Ventana = `[hoy, hoy + 7*semanas)`. Para cada regla de `recurrentes` y cada día de la ventana cuyo día de semana esté en `cada` → slot `(nombre, fecha)`.
- Instancias existentes = entregables en `entregables/` con `recurrente_de` y `recurrencia_fecha`. Clave = `(recurrente_de, recurrencia_fecha)` — **nunca** `vence` (puede haber sido movido).
- Slot sin instancia → crear `entregables/{fecha}-{slug(nombre)}.md` con meta: `tipo: entregable, cliente, formato, vence=fecha, estado: brief, responsable, recurrente_de=nombre, recurrencia_fecha=fecha, origen: "[[plan-contratado]]"` y `skill` si la regla lo trae; cuerpo `## Brief\n\n## Versiones\n`. Si el nombre de archivo existe (otro entregable), sufijo `-2`, `-3`.
- Instancia en la ventana cuya clave ya no es un slot (regla cambiada/eliminada) **y** `estado == "brief"` → eliminar archivo. Cualquier otro estado → no tocar.
- Instancias fuera de la ventana → no tocar.
- `cliente` = nombre de la carpeta.

- [ ] **Step 1: Tests que fallan** (plan fixture: `Post feed` cada `[mar, jue]`, responsable `marketing`; `hoy = 2026-10-26` lunes)

```python
def test_crea_slots_de_4_semanas(tmp_path):
    c = materializar(cli, date(2026,10,26))
    assert len(c.creados) == 8
    meta, _ = leer(cli/"entregables/2026-10-27-post-feed.md")
    assert meta["estado"] == "brief" and meta["recurrencia_fecha"] == date(2026,10,27)

def test_idempotente(tmp_path):
    materializar(cli, HOY); assert materializar(cli, HOY) == Cambios([], [])

def test_movido_no_se_duplica(tmp_path):
    materializar(cli, HOY)
    p = cli/"entregables/2026-10-27-post-feed.md"; m, b = leer(p); m["vence"] = date(2026,10,30); escribir(p, m, b)
    assert materializar(cli, HOY).creados == []

def test_cambio_de_regla_respeta_en_curso(tmp_path):
    materializar(cli, HOY)
    marcar_estado(cli/"entregables/2026-10-29-post-feed.md", "en_curso")
    cambiar_regla(cli, cada=["mar"])              # se quita jueves
    c = materializar(cli, HOY)
    assert len(c.eliminados) == 3                 # jueves 5/11, 12/11, 19/11 en brief
    assert (cli/"entregables/2026-10-29-post-feed.md").exists()

def test_colision_de_nombre(tmp_path): ...       # entregable manual previo con el mismo nombre de archivo → se crea "-2"
```

(`marcar_estado`/`cambiar_regla` son helpers del test.)

- [ ] **Steps 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat: materializar recurrentes`.

*ponytail:* solo reglas semanales por día; "1 evento por trimestre" o mensuales quedan como hitos manuales hasta que se necesiten.

---

### Task 5: Hooks — bitácora obligatoria, validación y sync

**Files:**
- Create: `.claude/hooks/stop.py`, `.claude/hooks/sync.sh`, `.claude/settings.json`
- Test: `tests/test_stop.py`, `tests/test_sync.py`

**Interfaces:**
- Consumes: `leer`, `validar`
- Produces:
  - `revisar(raiz: Path, session_id: str, cambiados: list[Path], ya_bloqueado: bool) -> str | None` — motivo de bloqueo o `None`
  - `stop.py` como script: lee JSON de stdin (`session_id`, `cwd`, `stop_hook_active`), obtiene `cambiados` de `git status --porcelain` (solo `.md` bajo carpetas de datos), y si `revisar` devuelve motivo imprime `{"decision": "block", "reason": motivo}`; si no, nada. Exit 0 siempre.
  - `sync.sh`: sin argumentos, corre en `$CLAUDE_PROJECT_DIR`.

Reglas de `revisar`:
0. Si `ya_bloqueado` → `None` (evita loop; el validador vuelve a correr en `recolectar` y en la próxima sesión).
1. Si algún cambiado tiene errores de `validar` → motivo con la lista `ruta: error`.
2. Si hay cambiados bajo `clientes/` y no existe archivo en `sesiones/` con `session_id` igual → motivo: `"Antes de terminar, escribe la bitácora de esta sesión en sesiones/YYYY-MM-DD-<persona>-<slug>.md (tipo: sesion, persona, fecha, session_id: <id>, clientes: [...]) con: qué se hizo, skill usada, correcciones del usuario, pendientes."`
3. Si no → `None`.

`sync.sh`: si no hay cambios ni commits por subir → exit 0. Si hay cambios: `git add -A && git commit -m "sesión: $AOS_PERSONA $(date +%F)"` (`AOS_PERSONA` cae a `git config user.name`). Luego `git pull --rebase --autostash`; si falla → `git rebase --abort`, mensaje a stderr `"agencia-os: conflicto al sincronizar; tu commit quedó local, resuélvelo con Claude"`, exit 0. Luego `git push`; si falla → aviso a stderr, exit 0. Sin remoto configurado → exit 0 silencioso.

`settings.json`: `Stop` → `uv run --project "$CLAUDE_PROJECT_DIR" python "$CLAUDE_PROJECT_DIR/.claude/hooks/stop.py"`; `SessionEnd` → `"$CLAUDE_PROJECT_DIR/.claude/hooks/sync.sh"` con `"timeout": 30`.

- [ ] **Step 1: Tests que fallan**

```python
def test_bloquea_sin_bitacora(repo): assert "bitácora" in revisar(repo, "s1", [repo/"clientes/acme/decisiones/x.md"], False)
def test_no_bloquea_con_bitacora(repo):
    escribir(repo/"sesiones/2026-10-26-jorge-acme.md", {"tipo":"sesion","persona":"jorge","fecha":"2026-10-26","session_id":"s1","clientes":["acme"]}, "")
    assert revisar(repo, "s1", [repo/"clientes/acme/decisiones/x.md"], False) is None
def test_no_loop(repo): assert revisar(repo, "s1", [repo/"clientes/acme/decisiones/x.md"], True) is None
def test_invalido_bloquea(repo): ...  # entregable sin responsable → motivo contiene "falta 'responsable'"
def test_sin_cambios_en_clientes(repo): assert revisar(repo, "s1", [], False) is None
```

`tests/test_sync.py` (con `tmp_path`: un remoto `--bare` y dos clones A y B; `CLAUDE_PROJECT_DIR` y `AOS_PERSONA` por env):

```python
def test_sube_cambios(): ...        # A modifica archivo, corre sync → remoto tiene commit "sesión: jorge ..."
def test_trae_cambios_ajenos(): ... # B sube; A cambia otro archivo y corre sync → A tiene ambos, remoto también
def test_conflicto_no_rompe(): ...  # A y B cambian la misma línea; B sube; A sync → exit 0, stderr contiene "conflicto",
                                    # A no está en medio de rebase (no existe .git/rebase-merge), y su commit sigue en el log
```

- [ ] **Steps 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Prueba en vivo:** abrir `claude` en el repo, pedir "crea clientes/acme/decisiones/2026-10-26-prueba.md sin frontmatter válido" → el Stop hook obliga a corregir y a escribir bitácora. Borrar los archivos de prueba.
- [ ] **Step 6: Commit** `feat: hooks de bitácora, validación y sync`.

---

### Task 6: CLAUDE.md, plantilla de cliente y skills de operación de datos

**Files:**
- Create: `CLAUDE.md`, `plantillas/cliente/{_ficha.md,contexto.md,brandbook.md,plan-contratado.md,material.md,linea-de-tiempo.md}`, `.claude/skills/procesar-reunion/SKILL.md`, `.claude/skills/materializar-recurrentes/SKILL.md`, `tests/fixtures/transcripcion-acme.md`

**Interfaces:**
- Consumes: CLIs `validar.py`, `cliente.py`, `materializar.py`
- Produces: convenciones que todas las skills siguientes citan (CLAUDE.md §"Dónde anotar qué").

`CLAUDE.md` debe contener (en este orden, conciso, <150 líneas):
1. Qué es el repo y que es la única fuente de verdad.
2. **Postura jefe de proyecto** (spec §8.9, las 5 viñetas literales).
3. Dónde anotar qué: tabla de spec §6 + modelo §7 (frontmatter mínimo por tipo, apuntando a `scripts/aos/esquemas.py`).
4. Al trabajar para un cliente: leer primero `_ficha.md`, `contexto.md`, `plan-contratado.md`, `brandbook.md`, `material.md`; al terminar anotar entregables/decisiones/línea de tiempo/aprendizajes en `contexto.md › Lo que aprendimos`.
5. Línea de tiempo: formato `YYYY-MM-DD · <tipo> · <[[link]]> <detalle> · <persona>`, tipos de spec §7.
6. Reglas de autonomía (spec §9 tabla) y privacidad (§9.1), con la instrucción de usar `uv run scripts/cliente.py` antes de escribir cualquier cosa sacada de correo/reuniones.
7. Skills en vivo: si algo ya se hizo/habló antes (buscar en `sesiones/`), decirlo y ofrecer convertirlo en skill.
8. Validar con `uv run scripts/validar.py <rutas>` antes de terminar; la bitácora de sesión la exige el hook.
9. Persona actual = `$AOS_PERSONA`.

`procesar-reunion` (input: ruta o texto de una transcripción + metadatos de asistentes): identifica cliente con `cliente.py` (si `ninguno` → no escribe nada; si ambiguo → nota mínima en `bandeja/` del dueño); crea `reuniones/YYYY-MM-DD-<slug>.md` (tipo reunion; secciones Resumen, Decisiones, Promesas `- [ ] <persona>: <qué> (<fecha>)`, Lo que aprendimos); cada decisión → `decisiones/`; cada promesa nuestra con fecha → entregable (`origen` = link a la reunión); aprendizajes → `contexto.md`; líneas en `linea-de-tiempo.md`; si la reunión cumple una promesa previa la marca. Si ya existe acta con el mismo `granola_id` → actualiza, no duplica.

`materializar-recurrentes`: corre `uv run scripts/materializar.py`, valida, agrega líneas `entregable_creado` a la línea de tiempo, y reporta.

- [ ] **Step 1:** escribir CLAUDE.md, plantillas (con frontmatter de ejemplo válido y comentarios de qué va en cada sección) y las dos skills (frontmatter `name`, `description` específica para que dispare bien).
- [ ] **Step 2: Prueba de aceptación** en una copia temporal: `cp -r tests/fixtures/repo /tmp/x && cp -r .claude CLAUDE.md scripts pyproject.toml /tmp/x/ && cd /tmp/x && git init -q && claude -p "/procesar-reunion tests/fixtures/transcripcion-acme.md"`. La transcripción fixture tiene: asistente `ana@acme.cl`, 1 decisión, 2 promesas nuestras con fecha, 1 promesa del cliente, 1 aprendizaje. Expected: 1 acta, 1 decisión, 2 entregables con `origen`, `contexto.md` con el aprendizaje, `uv run scripts/validar.py` exit 0.
- [ ] **Step 3:** misma prueba con transcripción cuyo único asistente externo es `x@gmail.com` → `git status` sin archivos nuevos.
- [ ] **Step 4: Commit** `feat: CLAUDE.md, plantilla de cliente y skills de reuniones/recurrentes`.

---

### Task 7: Briefs — de reunión y del día

**Files:**
- Create: `.claude/skills/brief-reunion/SKILL.md`, `.claude/skills/brief-del-dia/SKILL.md`

**Interfaces:**
- Consumes: CLAUDE.md, `cliente.py`, conector Google Calendar
- Produces: `clientes/<c>/reuniones/YYYY-MM-DD-brief-<slug>.md` (tipo brief-reunion) y `bandeja/YYYY-MM-DD-hoy-<persona>.md`

`brief-reunion` (arg opcional: fecha, default mañana): lista eventos del Calendar de la persona → por evento con asistentes externos usa `cliente.py` → si calza crea el brief con secciones exactas: **Para qué es esta reunión**, **Lo que sabemos**, **Lo prometido y su estado**, **Te propongo llevar** (spec mock iteración 2). Para clientes activos agrega números de la última `metricas/` si existen y entregables atrasados. Si ya existe brief para ese evento → lo actualiza.

`brief-del-dia` (persona = `$AOS_PERSONA` o arg): entregables con `responsable` = persona o `ia` que vencen en 7 días o están atrasados (no `publicado`/`cancelado`), promesas abiertas de reuniones recientes, briefs de reunión de hoy; **para cada pendiente una propuesta concreta de cómo avanzarlo o un borrador**; señales de jefe de proyecto (sobrecarga >5 entregables en la semana, próximo_contacto vencido, cliente sin actividad 14 días).

- [ ] **Step 1:** escribir ambas skills.
- [ ] **Step 2: Aceptación** sobre la copia con fixture + `materializar` corrido: `claude -p "/brief-del-dia marketing"` → el archivo en `bandeja/` lista los posts de la semana con responsable marketing, cada uno con propuesta.
- [ ] **Step 3: Commit** `feat: briefs de reunión y del día`.

---

### Task 8: Verificar conectores y skill de recolección

**Files:**
- Create: `.claude/skills/recolectar/SKILL.md`, `docs/conectores.md`
- Modify: `.mcp.json` (solo si algún servidor debe ir a nivel proyecto)

**Interfaces:**
- Consumes: `procesar-reunion`, `brief-reunion`, `cliente.py`
- Produces: skill `recolectar` invocable como `/recolectar <persona>`

- [ ] **Step 1: Verificar** (con Jorge, en claude.ai → Connectors y en una sesión de `/schedule` de prueba) qué hay disponible **en la nube**: Gmail, Google Calendar, Google Drive, Granola. Anotar en `docs/conectores.md`: conector, disponible en nube sí/no, lectura/escritura, cómo autenticar. Si Granola no está en la nube: documentar respaldo (Granola vía MCP local + tarea programada local con `claude -p` en el Mac de cada persona) y marcarlo como desviación del anti-objetivo 5 para que Jorge decida.
- [ ] **Step 2: Escribir `recolectar`**: desde la última corrida (guardada en `equipo/personas/<p>.md › ultima_recoleccion`) trae transcripciones de Granola, eventos de Calendar terminados y hilos de Gmail; filtra con `cliente.py` (internos = dominio de la agencia de `marca/marca.md`) y respeta exclusiones de la persona (`excluir_remitentes`, `excluir_calendarios`); por reunión → `procesar-reunion`; por correo relevante → línea de tiempo + pendientes; si la hora local es 18:xx → `brief-reunion` de mañana; si es 07:xx → `brief-del-dia`. Termina con `validar.py`, commit `agente: recolección <persona> <fecha-hora>` y `git push origin main` (con pull --rebase previo).
- [ ] **Step 3: Aceptación:** correr `/recolectar jorge` en local con una reunión real de prueba con un email de un cliente ficticio en la ficha → acta creada; una reunión personal → nada escrito.
- [ ] **Step 4: Commit** `feat: recolección de Granola/Calendar/Gmail`.

---

### Task 9: Obsidian — config, plugins y vistas

**Files:**
- Create: `.obsidian/app.json`, `.obsidian/community-plugins.json`, `.obsidian/core-plugins.json`, `.obsidian/plugins/<id>/{main.js,manifest.json,styles.css,data.json}`, `vistas/{hoy,calendario,entregables,equipo,lo-mio,pipeline,clientes}.base`
- Modify: `.gitignore` (agregar `.obsidian/workspace*.json`, `.obsidian/cache`, `.venv/`)

Plugins (bajar release más reciente de GitHub, commitear los archivos del plugin para que el equipo los tenga sin instalar): **Obsidian Git** (`obsidian-git`, config: auto pull/commit/push cada 5 min, mensaje `obsidian: {{date}}`), **Kanban Bases View**, **Yabacavi** (si no funciona con nuestras fechas: **Calendar Bases**), panel de Claude **Agent Sidebar** (si no corre el `claude` CLI con CLAUDE.md y hooks: **GuKi Chat**). Elegido + razón → `docs/conectores.md` § Obsidian.

Vistas (sintaxis: https://help.obsidian.md/bases/syntax):
- `hoy`: tabla, `tipo == entregable`, vence ≤ hoy+7, estado ∉ {publicado, cancelado}, orden vence; columnas Entregable, Cliente, Vence, Estado, Responsable, Origen.
- `calendario`: vista calendario por `vence`, todos los entregables y reuniones.
- `entregables`: kanban agrupado por `estado`.
- `equipo`: kanban columnas `estado`, carriles `responsable`.
- `lo-mio`: tabla filtrada por responsable = valor de una propiedad de la vista que cada persona fija (documentar cómo).
- `pipeline`: kanban de `tipo == cliente` por `etapa`.
- `clientes`: tabla de fichas: nombre, etapa, modalidad, responsable, próximo contacto.

- [ ] **Step 1:** instalar Obsidian (`brew install --cask obsidian`) y abrir el repo como bóveda.
- [ ] **Step 2:** instalar y configurar plugins; escribir las 7 vistas.
- [ ] **Step 3: Aceptación** con datos fixture copiados a `clientes/acme` (temporalmente): arrastrar un post en el calendario cambia `vence` en el archivo (`git diff` lo muestra) sin tocar `recurrencia_fecha`; `uv run scripts/validar.py` sigue en 0 tras editar en Obsidian; arrastrar en `equipo` cambia `estado`/`responsable`. Borrar `clientes/acme`.
- [ ] **Step 4: Commit** `feat: bóveda Obsidian con plugins y vistas`.

---

### Task 10: Onboarding — `/setup-espacio`, `/bienvenida`, `/nuevo-cliente`

**Files:**
- Create: `.claude/skills/setup-espacio/SKILL.md`, `.claude/skills/bienvenida/SKILL.md`, `.claude/skills/nuevo-cliente/SKILL.md`, `docs/tareas-programadas.md`

Las tres con `disable-model-invocation: true`.

`setup-espacio` (fase 1 = versión mínima): pide nombre de la agencia, dominio de email, logo/colores/tipografías/brandbook (archivos o links) → crea `marca/marca.md` (`tipo` no requerido; campos `nombre`, `dominio_email`) y `marca/tokens.yaml`; crea repo privado en GitHub con `gh repo create <nombre> --private --source . --push` **previa confirmación explícita**; protege nada más (push directo a main es el modo de trabajo). Generar skills de marca queda para fase 2 — la skill lo dice.

`bienvenida`: pregunta nombre, rol, clientes; crea `equipo/personas/<slug>.md` (tipo persona, `nivel_automatizacion: alto`, `excluir_remitentes: []`, `excluir_calendarios: []`); escribe `.claude/settings.local.json` con `{"env": {"AOS_PERSONA": "<slug>"}}`; verifica/instala `uv`, `gh` (auth), Obsidian; pide **consentimiento explícito** de privacidad citando spec §9.1 y lo registra en su ficha (`consentimiento_privacidad: YYYY-MM-DD`); guía a conectar Gmail/Calendar/Granola en claude.ai; crea sus tareas programadas según `docs/tareas-programadas.md`; explica cómo opera (resumen de CLAUDE.md + vistas); termina con prueba: `/brief-del-dia`.

`nuevo-cliente`: entrevista (nombre, etapa, modalidad, responsable, dominios/emails, link Drive, conectores, fuentes de métricas, lo contratado) + lee docs que le pasen → copia `plantillas/cliente/` a `clientes/<slug>/`, llena ficha/contexto/plan/brandbook; si hay link de Drive corre indexación de material (Task 11 skill); corre `materializar-recurrentes`; valida.

`docs/tareas-programadas.md` — tareas a crear con `/schedule` (repo `agencia-os`, prompt indica push a `main`; cron UTC, Chile = UTC-3):

| Tarea | Cuenta | Cron (UTC) | Prompt |
|---|---|---|---|
| recolectar-<persona> (nivel alto) | persona | `7 11-23/2 * * 1-5` | `/recolectar <persona>` |
| recolectar-<persona> (medio) | persona | `7 11,21 * * 1-5` | ídem |
| recolectar-<persona> (bajo) | persona | `7 11 * * 1-5` | ídem |
| recurrentes | Jorge | `7 9 * * 1` | `/materializar-recurrentes` y push |

El entorno de la nube necesita `uv`: setup script `curl -LsSf https://astral.sh/uv/install.sh | sh`. Repo seleccionado: `agencia-os`; el prompt de cada tarea termina con "haz commit y push directo a main".

(Las recolecciones de 07:xx y 18:xx locales disparan los briefs dentro de `recolectar`; para nivel bajo, `brief-reunion` corre en la misma pasada de la mañana para el día.)

- [ ] **Step 1:** escribir las 3 skills y el doc.
- [ ] **Step 2: Aceptación:** Jorge corre `/setup-espacio` y `/bienvenida` de verdad → existen `marca/`, `equipo/personas/jorge.md` con consentimiento, `settings.local.json`, repo en GitHub, tareas programadas creadas (`/schedule list`).
- [ ] **Step 3: Commit** `feat: onboarding de espacio, integrante y cliente`.

---

### Task 11: Índice de material y piloto Donna's

**Files:**
- Create: `.claude/skills/indexar-material/SKILL.md`
- Create (datos, vía skills): `clientes/donna/**`

`indexar-material` (arg: slug cliente): recorre la carpeta Drive de la ficha (solo lectura) → `material.md` agrupado por campaña/evento/tipo, una línea por pieza o carpeta: nombre, tipo (foto/video/logo/post/documento), descripción breve (mirando la imagen si es foto), fecha, link. En corridas siguientes solo agrega lo nuevo (guarda `ultimo_indexado` en el frontmatter de `material.md`). Nunca mueve ni edita en Drive.

- [ ] **Step 1:** escribir la skill.
- [ ] **Step 2:** con Jorge: `/nuevo-cliente` para Donna's (plan retainer: posts recurrentes, reporte semanal, eventos, DMs, ads; dominios `donnapet.cl`; Drive; ClickUp como conector declarado para fase 2) → carpeta completa, material indexado, recurrentes materializados.
- [ ] **Step 3:** `/bienvenida` para la persona de marketing y la de desarrollo (ellos mismos).
- [ ] **Step 4: Verificación del piloto (inicio):** `uv run pytest` verde; `uv run scripts/validar.py` exit 0; Obsidian muestra Donna's en `pipeline`, sus posts en `calendario` y `equipo`; la próxima reunión real con Donna's produce brief y acta automáticamente.
- [ ] **Step 5: Commit** `feat: indexación de material y piloto Donna's`.

---

## Fuera de esta fase (planes siguientes)

Fase 2: métricas semanales + `analisis-growth`, skills de marca (`reporte-ppt` primero), ClickUp bidireccional, skills de oficio (`brief-creativo`, `calendario-contenido`, `post-instagram`, `brandbook-cliente`, `propuesta-comercial`). Fase 3: `reflexion`, `crear-skill` con skill-creator, Graphify, "Lo que cambié". Fase 4: resto de clientes, plantilla reutilizable, panel Vercel.
