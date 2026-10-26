---
name: recolectar
description: Pasada de recolección de una persona - trae sus transcripciones de Granola, eventos de Calendar terminados y correos de Gmail desde la última corrida, se queda solo con lo que involucra clientes registrados, lo documenta y hace push a main. La corren las tareas programadas en la nube cada un par de horas; también sirve a mano con "/recolectar <persona>".
---

# recolectar

Argumento: slug de la persona (`/recolectar <persona>`). En pasadas automáticas `$AOS_PERSONA` puede
estar vacía: usa siempre el argumento. Los archivos de `bandeja/` van a esa persona; las líneas de
`linea-de-tiempo.md` y las bitácoras de la pasada llevan persona `ia` y mencionan de quién es la cuenta
leída ("cuenta de <persona>"). Sigue `CLAUDE.md` (§ Privacidad, § Línea de tiempo, § Autonomía). Solo
lectura en los conectores; nunca envíes nada hacia afuera.

## 1. Ventana

Lee `equipo/personas/<persona>.md`. Ventana = desde `ultima_recoleccion` (frontmatter, `YYYY-MM-DDTHH:MM`)
hasta ahora. Si falta el campo, últimas 24 h. Anota la hora de inicio de esta pasada (no la de fin).
Lee también `excluir_remitentes` y `excluir_calendarios` de la ficha de la persona (si existen) y
`dominio_email` de `marca/marca.md`.

Si un conector no responde, sigue con los demás y, al final, NO actualices `ultima_recoleccion`.

## 2. Reúne (solo lectura)

- **Granola**: transcripciones de la ventana, con fecha, título, asistentes con email y `granola_id`.
- **Calendar**: eventos terminados en la ventana, salvo calendarios en `excluir_calendarios`.
- **Gmail**: hilos de la ventana, salvo remitentes en `excluir_remitentes`.

## 3. Filtro de privacidad (antes de escribir NADA)

Por cada reunión, evento o hilo: saca los emails pelados de los participantes que no son del
`dominio_email` de la agencia y corre `uv run scripts/cliente.py <email> [<email>...]`.
- Sin externos o `ninguno` → descártalo sin escribir ni mencionarlo en ninguna parte.
- `ambiguo: ...` → solo `bandeja/YYYY-MM-DD-por-clasificar-<persona>.md` (sin frontmatter; si existe,
  agrega al final) con fecha, título, emails y clientes candidatos; sin contenido.
- Un slug → cliente `<c>`; sigue.

## 4. Documenta

- **Reunión con transcripción de Granola** → skill `procesar-reunion` (dedup por `granola_id`).
- **Evento de Calendar terminado sin Granola** → nota mínima vía `procesar-reunion` con `fuente: notas`;
  dedup por fecha + slug del título: si ya existe `clientes/<c>/reuniones/YYYY-MM-DD-<slug>.md`, no lo
  vuelvas a crear. Un evento que ya tiene acta por `granola_id` tampoco se duplica.
- **Correo relevante** → una línea `…· reunion|estado|decision …` en `linea-de-tiempo.md` solo si hay un
  hecho (algo se acordó, se aprobó, cambió una fecha), y los pendientes que pida el cliente como
  entregable `estado: brief` con `origen` al hilo descrito (fecha, asunto) o, si no tienen fecha, en una
  nota en `bandeja/` de la persona. Nunca copies cuerpos de correo. Borradores de respuesta: solo en la bandeja.
- Lo que dependa de un dato que falta (fecha, cliente) va a la bandeja de la persona, no se adivina.

## 5. Briefs según la hora local (America/Santiago)

- Hora `18:xx` → skill `brief-reunion` para mañana.
- Hora `07:xx` → skill `brief-del-dia`.
Otra hora → ninguno. Calcula la hora con `TZ=America/Santiago date +%H`.

## 6. Cierre

1. `uv run scripts/validar.py` → corrige hasta que no imprima nada.
2. Si tocaste `clientes/`, bitácora `sesiones/YYYY-MM-DD-ia-recoleccion-<persona>.md` (CLAUDE.md § Antes de
   terminar, persona `ia`, "cuenta de <persona>").
3. Solo si todo salió bien: pon `ultima_recoleccion` = inicio de la pasada en `equipo/personas/<persona>.md`
   (el esquema acepta el campo; valida de nuevo).
4. Commit `agente: recolección <persona> <YYYY-MM-DD-HHMM>` (nada que commitear → termina sin commit),
   `git pull --rebase` y `git push origin main`.
5. Si el rebase tiene conflicto: `git rebase --abort`, no empujes nada, deja una nota en
   `bandeja/YYYY-MM-DD-recoleccion-fallida-<persona>.md` y termina. Jamás `--force`.

Resume en 3-5 líneas qué documentaste, qué quedó en la bandeja y los próximos pasos con responsable.
Una pasada repetida sobre la misma ventana no debe cambiar nada.
