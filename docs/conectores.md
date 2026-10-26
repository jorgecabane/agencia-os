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
hora del cron: `recolectar` genera el brief del día en la primera pasada desde las 06:00 de Santiago y los
briefs de mañana en la primera desde las 17:00. Un conector no configurado se salta; uno con error no
avanza el cursor `ultima_recoleccion`.

## Cómo verificar

- [ ] claude.ai → Connectors: confirmar que existen Gmail, Google Calendar, Google Drive y Granola; anotar si Granola aparece.
- [ ] Autenticar cada uno con la cuenta de la persona (Granola con la cuenta donde se graban sus reuniones).
- [ ] Crear con `/schedule` una tarea de prueba (repo del equipo, rama por defecto) cuyo prompt solo liste: últimas 3 transcripciones de Granola, eventos de Calendar de ayer y 3 hilos recientes de Gmail (solo asunto y fecha). Confirmar que cada conector responde en la nube.
- [ ] Anotar por conector si en la nube puede escribir o solo leer, y qué permisos pidió.
- [ ] Confirmar que la tarea puede hacer `git push origin HEAD:main` (orden explícita en el prompt) y que no queda solo en una rama `claude/`.
- [ ] Confirmar la cadencia elegida y que el cron en UTC cae donde se espera en hora de Santiago.
- [ ] Actualizar la tabla con sí/no y la fecha de verificación.
- [ ] Aceptación (Task 8, paso 3): correr `/recolectar <persona>` con una reunión real que incluya el email de un cliente ficticio de la ficha, y comprobar que se crea el acta; con una reunión personal, que no se escribe nada.

## Respaldo si Granola no está en la nube

Granola por MCP local en el Mac de cada persona, más una tarea programada local que ejecute
`claude -p "/recolectar <persona>"` en ese Mac (cron/launchd, cada 2 h). Sirve lo mismo para Gmail y
Calendar. Desventajas: solo corre con el Mac encendido y despierto, y cada persona mantiene su propia
configuración.

Desviación del anti-objetivo 5 (nada depende de la máquina de una persona): este respaldo la incumple.
Decisión pendiente del dueño del espacio: aceptarla solo para Granola, o esperar a que exista el conector
en la nube y mientras tanto procesar las reuniones a mano con `procesar-reunion`.
