# Tareas programadas

Se crean con `/schedule` (la skill `/bienvenida` te guía; no se pueden crear en silencio). Todas usan el repo
`agencia-os` y la rama por defecto. Cron en UTC (Chile = UTC-3 en verano, UTC-4 en invierno), minuto `:07`,
intervalo mínimo 1 h. Cada prompt termina con "haz commit y push directo a main".

## Entorno en la nube

Necesita `uv`. En el entorno de las tareas, setup script:

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Tareas

| Tarea | Cuenta | Cron (UTC) | Prompt |
|---|---|---|---|
| `recolectar-<persona>` (nivel alto) | persona | `7 11-23/2 * * 1-5` | `/recolectar <persona>` y, al final, haz commit y push directo a main |
| `recolectar-<persona>` (nivel medio) | persona | `7 11,21 * * 1-5` | ídem |
| `recolectar-<persona>` (nivel bajo) | persona | `7 11 * * 1-5` | ídem |
| `recurrentes` | dueño del espacio | `7 9 * * 1` | `/materializar-recurrentes` y, al final, haz commit y push directo a main |

`<persona>` es el slug de `equipo/personas/<slug>.md`. La tarea `recurrentes` la crea una sola persona
(el dueño del espacio), no una por integrante.

## Cómo disparan los briefs

Los briefs no dependen del cron: `recolectar` genera `brief-del-dia` en la primera pasada desde las 06:00
de Santiago y `brief-reunion` (de mañana) en la primera pasada desde las 17:00. Con nivel alto y medio
ambos salen solos. Con nivel bajo hay una sola pasada por la mañana, así que solo sale el brief del día;
el brief de reunión se pide a mano con `/brief-reunion`.

## Cada persona

Cada integrante crea solo su tarea `recolectar-<persona>`, con sus propios conectores de claude.ai
(ver `docs/conectores.md`). Una tarea nunca lee las cuentas de otra persona.
