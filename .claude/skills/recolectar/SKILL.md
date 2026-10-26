---
name: recolectar
description: Pasada de recolección de una persona - trae sus transcripciones de Granola, eventos de Calendar terminados y correos de Gmail desde la última corrida, se queda solo con lo que involucra clientes registrados, lo documenta y hace push a main. La corren las tareas programadas en la nube cada un par de horas; también sirve a mano con "/recolectar <persona>".
---

# recolectar

Argumento: slug de la persona (`/recolectar <persona>`). En pasadas automáticas `$AOS_PERSONA` puede
estar vacía: usa siempre el argumento. Los archivos de `bandeja/` van a esa persona; las líneas de
`linea-de-tiempo.md` y la bitácora de la pasada llevan persona `ia` y mencionan de quién es la cuenta
leída ("cuenta de <persona>"). Sigue `CLAUDE.md` (§ Privacidad, § Línea de tiempo, § Autonomía). Solo
lectura en los conectores; nunca envíes nada hacia afuera.

**Idempotente**: una pasada repetida sobre la misma ventana no debe cambiar nada. Antes de cada escritura
comprueba que no exista ya (ver § 4). Horas y fechas, siempre en America/Santiago: `TZ=America/Santiago date +%Y-%m-%dT%H:%M`.

## 0. Git al inicio

`git switch main && git pull --rebase origin main`. Si `git branch --show-current` no imprime `main`, detente y
repórtalo en el resumen final. Nunca `--force`.

## 1. Ventana

Lee `equipo/personas/<persona>.md`. Ventana = desde `ultima_recoleccion` (`YYYY-MM-DDTHH:MM`, hora de
Santiago) hasta ahora; si falta el campo, últimas 24 h. Guarda la hora de inicio de esta pasada (no la de fin).
Lee `excluir_remitentes` y `excluir_calendarios` de esa ficha (si existen) y `dominio_email` de `marca/marca.md`.

Conectores (regla del dueño del espacio):
- **No configurado o no disponible** → sáltalo, avanza igual el cursor y menciónalo en el resumen.
- **Configurado pero con error** → sigue con los demás, **no** avances `ultima_recoleccion` y repórtalo.

## 2. Reúne (solo lectura)

- **Granola**: transcripciones de la ventana, con fecha, título, asistentes con email y `granola_id`.
- **Calendar**: eventos terminados en la ventana, salvo calendarios en `excluir_calendarios`.
- **Gmail**: hilos de la ventana, salvo remitentes en `excluir_remitentes`.

## 3. Filtro de privacidad (antes de escribir NADA)

Por cada reunión, evento o hilo: emails pelados de los participantes que no son del `dominio_email` de la
agencia, y `uv run scripts/cliente.py <email> [<email>...]`.
- Sin externos o `ninguno` → descártalo sin escribir ni mencionarlo en ninguna parte.
- `ambiguo: ...` → solo `bandeja/YYYY-MM-DD-reunion-por-clasificar-<persona>.md` (mismo nombre que usan
  `procesar-reunion` y `brief-reunion`; sin frontmatter; si existe, agrega al final) con fecha, título,
  emails y clientes candidatos; sin contenido. Antes de agregar, comprueba que no haya ya una entrada con la misma fecha + título.
- Un slug → cliente `<c>`; sigue.

## 4. Documenta

Al invocar `procesar-reunion`, `brief-reunion` o `brief-del-dia` desde acá, pásales `<persona>` explícita;
su bitácora y su respuesta final en el chat las cubre la única bitácora de § 6 y el resumen de recolectar.

- **Reunión con transcripción de Granola** → `procesar-reunion` (dedup por `granola_id`).
- **Evento de Calendar terminado sin Granola** → `procesar-reunion` con `fuente: notas`. Dedup: no lo crees
  si ya hay acta con el mismo `granola_id`, o con la misma fecha + slug del título, o con fecha + hora de
  inicio (±15 min) y emails de asistentes en común (los títulos de Calendar y Granola pueden diferir).
- **Correo relevante** → solo si hay un hecho (algo se acordó, aprobó, cambió una fecha):
  - Línea en `linea-de-tiempo.md` con tipo `estado` (CLAUDE.md no tiene tipo `correo`; `estado` es el más cercano):
    `YYYY-MM-DD · estado · [[<entregable creado>]] o [[_ficha]] correo "<asunto>": <hecho> · ia (cuenta de <persona>)`.
    Antes de agregarla, comprueba que no exista una línea idéntica.
  - Pedidos con fecha → entregable `estado: brief` en `clientes/<c>/entregables/<vence>-<slug>.md`, solo si
    no existe ya otro con mismo cliente + `vence` + slug. `origen: "[[linea-de-tiempo]]"`; fecha y asunto del correo en el cuerpo (`## Brief`).
  - Pendientes sin fecha o borradores de respuesta: nota en `bandeja/` de la persona. Nunca copies cuerpos de correo.
- Lo que dependa de un dato que falta (fecha, cliente) va a la bandeja de la persona; no se adivina.

## 5. Briefs (independientes de la hora del cron)

Hora local de Santiago:
- Primera pasada a las 06:00 o después, si no existe `bandeja/<hoy>-hoy-<persona>.md` → `brief-del-dia`.
- Primera pasada a las 17:00 o después, si aún no están los briefs de mañana (`tipo: brief-reunion` con
  fecha de mañana en `clientes/*/reuniones/` para las reuniones de mañana de la persona) → `brief-reunion` para mañana.

## 6. Cierre

1. `uv run scripts/validar.py` → corrige hasta que no imprima nada.
2. Si tocaste `clientes/`, bitácora `sesiones/YYYY-MM-DD-ia-recoleccion-<persona>-HHMM.md` (CLAUDE.md § Antes de
   terminar; persona `ia`, "cuenta de <persona>").
3. Si no hubo errores de conectores configurados, `ultima_recoleccion` = inicio de la pasada, en hora de
   Santiago, en `equipo/personas/<persona>.md`; valida de nuevo.
4. Commit `agente: recolección <persona> <YYYY-MM-DD-HHMM>` (hora de Santiago), luego `git pull --rebase origin main`
   y `git push origin HEAD:main`. Esta es la excepción a "no hagas push a mano" de CLAUDE.md: las pasadas
   automáticas no tienen hook `SessionEnd`.
5. Conflicto en el rebase: `git rebase --abort`, no empujes nada y **no dejes nota en el repo** (no se puede
   empujar de forma segura y el clon es desechable); reporta el fallo en el resumen final, que es lo que le llega a la persona.

Resume en 3-5 líneas qué documentaste, qué quedó en la bandeja, conectores saltados o con error, y los
próximos pasos con responsable.
