---
name: bienvenida
description: Onboarding de cada integrante del equipo - crea su ficha en equipo/personas, fija su persona en .claude/settings.local.json, revisa herramientas, pide consentimiento de privacidad, conecta Gmail/Calendar/Granola, guía la creación de sus tareas programadas y termina con /brief-del-dia. Corre solo con "/bienvenida".
disable-model-invocation: true
---

# bienvenida

Habla en español de Chile (tú). Una pregunta a la vez. No escribas nada sobre emails o reuniones de la persona
en este flujo: solo su ficha.

## 1. Preséntate y pregunta

Explica en dos líneas qué vas a hacer. Pregunta:
1. Nombre completo y rol.
2. Con qué clientes trabaja (puede ser "aún no sé"; los clientes se crean con `/nuevo-cliente`).
3. Nivel de automatización: `alto` (recolección cada 2 h en horario laboral), `medio` (2 veces al día) o `bajo` (1 vez al día). Propón `alto`.

Slug = nombre en minúsculas, sin tildes, con guiones (usa `uv run python -c "import sys; sys.path.insert(0,'scripts'); from aos.slug import slug; print(slug(sys.argv[1]))" "<nombre>"`).

## 2. Herramientas

Verifica cada una; si falta, ofrece instalarla y espera su "sí":
- `uv --version` (si falta: `curl -LsSf https://astral.sh/uv/install.sh | sh`).
- `gh auth status` (si no hay sesión: que corra `gh auth login`).
- Obsidian: `ls /Applications/Obsidian.app`; si falta, `brew install --cask obsidian`. Luego que abra la carpeta del repo como bóveda y acepte "Activar plugins de la comunidad" (ver `docs/conectores.md`, § Obsidian).

## 3. Consentimiento de privacidad (explícito)

Dile, en palabras simples, lo que dice la spec §9.1, y pide un "sí" claro antes de seguir:

> Para recolectar, leeré tu correo, tu calendario y tus reuniones de Granola. Las reglas:
> - Solo guardo reuniones, transcripciones y correos donde participe alguien registrado en la ficha de un cliente o prospecto (por su dominio o email exacto).
> - Todo lo demás lo ignoro y no lo escribo en ninguna parte, ni siquiera en la bandeja. Nunca guardo 1:1 internas, temas personales, sueldos ni precios internos.
> - Cualquier dirección de un dominio registrado de un cliente cuenta como ese cliente (aunque sea un contacto nuevo).
> - Si algo calza con dos o más clientes a la vez, lo dejo en tu bandeja personal con lo mínimo para que decidas (fecha, título, emails y clientes candidatos), sin contenido.
> - Puedes excluir remitentes, etiquetas o calendarios cuando quieras; solo avísame.
>
> ¿Aceptas que lo haga así con tus cuentas? (sí/no)

Pregunta también si quiere excluir de entrada algún remitente o calendario (llena `excluir_remitentes` / `excluir_calendarios`).

**Si dice que no (o duda):** igual creas la ficha (sin `consentimiento_privacidad`) y `.claude/settings.local.json` con `AOS_PERSONA` (paso 4), porque los hooks y `/nuevo-cliente` necesitan una persona. Solo omites los conectores (paso 5) y las tareas programadas (paso 6): no conectes cuentas ni guíes ninguna tarea. Explica que puede volver a correr `/bienvenida` cuando quiera. Haz los pasos 4, 7 y 8 y salta los 5 y 6.

## 4. Crea la ficha y la persona local

`equipo/personas/<slug>.md`:

```markdown
---
tipo: persona
nombre: <nombre>
slug: <slug>
rol: <rol>
nivel_automatizacion: <alto|medio|bajo>
zona_horaria: <IANA; detecta con `readlink /etc/localtime`, ej. America/Santiago>
excluir_remitentes: []
excluir_calendarios: []
consentimiento_privacidad: <YYYY-MM-DD de hoy>   # solo si dijo sí; si rechazó, omite esta línea
---

# <nombre>

Clientes: <lista de [[clientes/<slug>/_ficha]] o "por definir">
```

No pongas `ultima_recoleccion` ni `briefs_reunion_hasta`: los agrega `recolectar`. Si hay exclusiones, ponlas en las listas.

`.claude/settings.local.json` (está en `.gitignore`; comprueba con `git check-ignore .claude/settings.local.json`; si no responde, agrega la línea al `.gitignore`). Si el archivo ya existe, fusiona sin borrar lo que tenga:

```json
{"env": {"AOS_PERSONA": "<slug>"}}
```

Dile que reinicie Claude Code en esta carpeta para que tome la persona. Valida: `uv run scripts/validar.py`.

## 5. Conectores (solo con consentimiento)

Guíala en claude.ai → Connectors a conectar con su cuenta: Gmail, Google Calendar, Granola (y Google Drive si los clientes comparten ahí). Cada persona conecta lo suyo. Cuando diga que listo, comprueba que aparezcan en `/mcp`; lo que no esté se anota para decírselo al final (recolectar los salta si no están).

## 6. Tareas programadas (solo con consentimiento)

No puedes crearlas en silencio: la guías a crearlas con `/schedule`, una por una, según `docs/tareas-programadas.md` (el repo que creó `/setup-espacio`, cron UTC, minuto :07, prompt que termina con "haz commit y push directo a main"). Para su nivel:

- Tarea `recolectar-<slug>`: cron del nivel elegido y prompt `/recolectar <slug>`.
- Si es el dueño del espacio y aún no existe: tarea `recurrentes` con `/materializar-recurrentes`.
- Recuérdale que el entorno de la nube necesita el setup script de `uv` (está en el doc).

Antes de cada una muéstrale el nombre, el cron y el prompt exactos, y que **confirme** que la creó (`/schedule list`). No des una por creada sin su confirmación.

## 7. Cómo operamos

Explica en 5 líneas, sin jerga: (1) el repo es la única fuente de verdad y yo, el agente, dejo todo documentado en el cliente correcto; (2) actúo como jefe de proyecto: cierro con próximos pasos y aviso lo que vence; (3) hacia afuera (correos, publicar, DMs, ads) solo dejo borradores para que tú apruebes; (4) todo cambio es un commit y se puede revertir; (5) en Obsidian ves las vistas `hoy`, `lo-mio`, `calendario`, `entregables`, `pipeline`, `equipo` y `clientes`. Para `lo-mio`, que duplique `vistas/lo-mio.base` como `vistas/lo-mio.local.base` y ponga su slug en `formulas.yo`.

## 8. Prueba y commit

Haz commit de la ficha (`feat: ficha de <slug>`) sin `settings.local.json`. Termina corriendo `/brief-del-dia` para que vea el resultado; si no hay clientes aún, dile que saldrá vacío y que el siguiente paso es `/nuevo-cliente`.
