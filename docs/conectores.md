# Conectores para la recolección en la nube

Lo de esta sección viene de la documentación de Claude Code y debe confirmarse (ver tabla): las tareas
programadas en la nube clonan el repo desde la rama por defecto en cada corrida e incluyen por defecto
todos los conectores de claude.ai de quien las crea (los conectores pueden escribir, no solo leer). Los
servidores `claude mcp add` locales no existen en la nube, salvo que sean conectores de claude.ai o estén en un
`.mcp.json` versionado (no hace falta aquí). Intervalo mínimo: 1 hora; cron en UTC; secretos como
variables de entorno del entorno en la nube. Por defecto Claude empuja a ramas `claude/`; el prompt de
`recolectar` ordena push a `main`. Estos comportamientos de `/schedule`: por verificar (dueño del espacio).

## Estado

| Conector | Disponible en nube | Lectura/escritura | Cómo autenticar | Estado |
|---|---|---|---|---|
| Gmail | por verificar (dueño del espacio) (se espera conector de claude.ai) | por verificar (dueño del espacio) | claude.ai → Connectors → Gmail, con la cuenta de cada persona | por verificar (dueño del espacio) |
| Google Calendar | por verificar (dueño del espacio) (se espera conector de claude.ai) | por verificar (dueño del espacio) | claude.ai → Connectors → Google Calendar | por verificar (dueño del espacio) |
| Google Drive | por verificar (dueño del espacio) (se espera conector de claude.ai) | por verificar (dueño del espacio) | claude.ai → Connectors → Google Drive | por verificar (dueño del espacio) |
| Granola | por verificar (dueño del espacio) | por verificar (dueño del espacio) | por verificar (dueño del espacio) | por verificar (dueño del espacio) |

Cada persona conecta sus propias cuentas: la tarea de una persona lee solo sus conectores.

## Cadencia

Cualquier cadencia sirve (mínimo 1 h, cron UTC, minuto :07; ej. cada 2 h). Los briefs no dependen de la
hora del cron: `recolectar` genera el brief del día en la primera pasada desde las 06:00 de la `zona_horaria` de la persona y los
briefs de mañana en la primera desde las 17:00. Un conector no configurado se salta; uno con error no
avanza el cursor `ultima_recoleccion`.

## Cómo verificar

- [ ] claude.ai → Connectors: confirmar que existen Gmail, Google Calendar, Google Drive y Granola; anotar si Granola aparece.
- [ ] Autenticar cada uno con la cuenta de la persona (Granola con la cuenta donde se graban sus reuniones).
- [ ] Crear con `/schedule` una tarea de prueba (repo del equipo, rama por defecto) cuyo prompt solo liste: últimas 3 transcripciones de Granola, eventos de Calendar de ayer y 3 hilos recientes de Gmail (solo asunto y fecha). Confirmar que cada conector responde en la nube.
- [ ] Anotar por conector si en la nube puede escribir o solo leer, y qué permisos pidió.
- [ ] Habilitar push a `main` (no solo a ramas `claude/`) en el entorno de tareas programadas (configuración del entorno/permisos de GitHub de `/schedule`); sin esto el push de `recolectar` falla o queda en una rama que nadie mergea.
- [ ] Confirmar que la tarea puede hacer `git push origin HEAD:main` (orden explícita en el prompt) y que no queda solo en una rama `claude/`.
- [ ] Confirmar la cadencia elegida y que el cron en UTC cae donde se espera en la hora local de cada persona.
- [ ] Actualizar la tabla con sí/no y la fecha de verificación.
- [ ] Aceptación (Task 8, paso 3): correr `/recolectar <persona>` con una reunión real que incluya el email de un cliente ficticio de la ficha, y comprobar que se crea el acta; con una reunión personal, que no se escribe nada.

## Respaldo si Granola no está en la nube

Granola por MCP local en el Mac de cada persona, más una tarea programada local que ejecute
`claude -p "/recolectar <persona>"` en ese Mac (cron/launchd, cada 2 h), **en un clon aparte** del repo
(p. ej. `~/agencia-os-recoleccion`), nunca en la bóveda de Obsidian: `recolectar` corre `git switch main`
y `git pull --rebase`, lo que pisaría la rama o el trabajo sin commitear de la persona. Sirve lo mismo para Gmail y
Calendar. Desventajas: solo corre con el Mac encendido y despierto, y cada persona mantiene su propia
configuración.

Desviación del anti-objetivo 5 (nada depende de la máquina de una persona): este respaldo la incumple.
Decisión pendiente del dueño del espacio: aceptarla solo para Granola, o esperar a que exista el conector
en la nube y mientras tanto procesar las reuniones a mano con `procesar-reunion`.

## Obsidian

Obsidian abre el repo como bóveda; es solo la capa visual (calendario, kanban, tablas con el plugin
núcleo Bases). Los archivos de cada plugin están commiteados en `.obsidian/plugins/` para que nadie
instale nada: al abrir la bóveda, aceptar "Activar plugins de la comunidad". Obsidian mínimo: 1.11.4.

| Plugin | Repo | Versión | Por qué |
|---|---|---|---|
| Obsidian Git (`obsidian-git`) | https://github.com/Vinzent03/obsidian-git | 2.42.0 | Pull, commit y push automáticos cada 5 min (mensaje `obsidian: {{date}}`, pull al abrir); evita que el equipo use git a mano. |
| Kanban Bases View (`kanban-bases-view`) | https://github.com/xiwcx/obsidian-bases-kanban | 0.10.6 | Vista `kanban-view` con columnas por propiedad (`groupByProperty`) y carriles (`swimlaneByProperty`); arrastrar una tarjeta reescribe esa propiedad. |
| Yabacavi (`yabacavi`) | https://github.com/xupisco/obsidian-yabacavi | 0.7.2 | Vista `calendar-cards`. Su README dice que arrastrar una tarjeta reescribe la propiedad de fecha elegida (conserva hora; fecha sola sigue siendo fecha sola), así que solo cambia `vence`, nunca `recurrencia_fecha`. No hizo falta el respaldo Calendar Bases. |
| Agent Sidebar (`agent-sidebar`) | https://github.com/vsaraikin/obsidian-claude-plugin | 0.1.5 | Según su README lanza el binario `claude` ya instalado vía Claude Agent SDK con la bóveda como directorio, "so your CLAUDE.md, settings, skills and MCP servers apply as they do in a terminal"; el bundle pasa `settingSources`, por lo que los hooks del repo (`.claude/settings.json`) aplican. Por verificar en uso real. No hizo falta GuKi Chat. |

Instalados desde el último release de cada repo oficial (tomado de `community-plugins.json` de
obsidian-releases); sin ejecutar nada al bajarlos. Agent Sidebar aún no está revisado por Obsidian y
pide `claude` con sesión iniciada; Anthropic pide API key para herramientas de terceros sobre el SDK.

### Vistas (`vistas/*.base`)

`hoy`, `calendario`, `entregables`, `equipo`, `lo-mio`, `pipeline`, `clientes`.

- **calendario**: Yabacavi solo admite una propiedad de fecha por vista, así que hay dos vistas en el
  mismo archivo: `Entregables` (por `vence`, arrastrable) y `Reuniones` (por `fecha`).
- **lo-mio**: Bases no tiene variable de usuario. El filtro compara `responsable` con la fórmula
  `yo`, que viene con el valor de relleno `TU-SLUG`. Cada persona duplica el archivo como
  `vistas/lo-mio.local.base` (git lo ignora), pone su slug en `formulas.yo` y usa esa copia.
- Obsidian reescribe los `.base` al editarlos desde la interfaz y borra los comentarios YAML.

### Verificación pendiente (dueño del espacio, en la app)

- [ ] Las vistas muestran solo registros bajo `clientes/` (no plantillas ni fixtures).
- [ ] Los kanban muestran columnas en el orden del enum (se fijó con `columnOrders`, clave leída del código del plugin).
- [ ] Instalar Obsidian (`brew install --cask obsidian`) y abrir el repo como bóveda; activar plugins.
- [ ] Con datos de prueba en `clientes/acme` (temporal): arrastrar un post en `calendario` cambia `vence` (`git diff`) y no toca `recurrencia_fecha`.
- [ ] `uv run scripts/validar.py` sigue en 0 tras editar en Obsidian.
- [ ] Arrastrar en `equipo` cambia `estado` o `responsable`.
- [ ] Agent Sidebar: confirmar que lee CLAUDE.md y dispara los hooks. Borrar `clientes/acme`.
