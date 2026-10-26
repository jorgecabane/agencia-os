# Conectores para la recolección en la nube

Las tareas programadas en la nube (`/schedule`) clonan el repo desde la rama por defecto en cada corrida
e incluyen por defecto todos los conectores de claude.ai de quien las crea (los conectores pueden
escribir, no solo leer). Los servidores `claude mcp add` locales no existen en la nube, salvo que sean
conectores de claude.ai o estén declarados en un `.mcp.json` versionado (no hace falta para estos). Intervalo
mínimo: 1 hora; el cron va en UTC; los secretos, como variables de entorno del entorno en la nube. Por
defecto Claude empuja a ramas `claude/`; el prompt de `recolectar` ordena push a `main`.

## Estado

| Conector | Disponible en nube | Lectura/escritura | Cómo autenticar | Estado |
|---|---|---|---|---|
| Gmail | sí (conector de claude.ai) | por verificar (Jorge) | claude.ai → Connectors → Gmail → conectar con la cuenta de cada persona | por verificar (Jorge) |
| Google Calendar | sí (conector de claude.ai) | por verificar (Jorge) | claude.ai → Connectors → Google Calendar | por verificar (Jorge) |
| Google Drive | sí (conector de claude.ai) | por verificar (Jorge) | claude.ai → Connectors → Google Drive | por verificar (Jorge) |
| Granola | por verificar (Jorge) | por verificar (Jorge) | por verificar (Jorge) | por verificar (Jorge) |

Cada persona conecta sus propias cuentas: la tarea programada de una persona lee solo sus conectores.

## Cómo verificar

- [ ] claude.ai → Connectors: confirmar que existen Gmail, Google Calendar, Google Drive y Granola; anotar si Granola aparece.
- [ ] Autenticar cada uno con la cuenta de la persona (Granola con la cuenta donde se graban sus reuniones).
- [ ] Crear con `/schedule` una tarea de prueba (repo del equipo, rama por defecto) cuyo prompt solo liste: últimas 3 transcripciones de Granola, eventos de Calendar de ayer y 3 hilos recientes de Gmail (solo asunto y fecha). Confirmar que cada conector responde en la nube.
- [ ] Anotar por conector si en la nube puede escribir o solo leer, y qué permisos pidió.
- [ ] Confirmar que la tarea puede hacer `git push origin main` (prompt con la orden explícita) y que no queda solo en una rama `claude/`.
- [ ] Cron en UTC con minuto :07 (ej. cada 2 h); comprobar que las pasadas de las 07:xx y 18:xx de Santiago existen (cambia con el horario de verano).
- [ ] Actualizar la tabla de arriba con sí/no y la fecha de verificación.
- [ ] Aceptación (Task 8, paso 3): correr `/recolectar <persona>` con una reunión real que incluya el email de un cliente ficticio de la ficha, y comprobar que se crea el acta; con una reunión personal, que no se escribe nada.

## Respaldo si Granola no está en la nube

Granola por MCP local en el Mac de cada persona, más una tarea programada local que ejecute
`claude -p "/recolectar <persona>"` en ese Mac (cron/launchd, cada 2 h). Sirve lo mismo para Gmail y
Calendar. Desventajas: solo corre con el Mac encendido y despierto, y cada persona mantiene su propia
configuración.

Desviación del anti-objetivo 5 (nada depende de la máquina de una persona): este respaldo la incumple.
Decisión pendiente de Jorge: aceptarla solo para Granola, o esperar a que exista el conector en la nube
y mientras tanto procesar las reuniones a mano con `procesar-reunion`.
