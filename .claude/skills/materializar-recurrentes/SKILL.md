---
name: materializar-recurrentes
description: Crea los entregables recurrentes de las próximas 4 semanas a partir de las reglas `recurrentes` de cada plan-contratado.md, los anota en la línea de tiempo y reporta. Úsala los lunes, al crear o cambiar el plan de un cliente, o cuando pidan "materializa/genera los recurrentes", "arma los entregables del mes" o "actualiza el calendario según el plan".
---

# materializar-recurrentes

Persona = `$AOS_PERSONA` (o `ia` si es una pasada automática).

1. Corre `uv run scripts/materializar.py --detalle` (para probar otra fecha: `--hoy YYYY-MM-DD`). Imprime
   `<cliente>: +N -M` por cliente y debajo cada archivo: `  + <ruta>` creado, `  - <ruta>` eliminado
   (futuros en `brief` que nadie tocó y que la regla ya no genera). Usa solo esa lista, no `git status`.
2. Valida: `uv run scripts/validar.py` (sin rutas valida todo) → corrige hasta que no imprima nada.
3. Por cada entregable creado, agrega al final de `clientes/<c>/linea-de-tiempo.md` (créala desde
   `plantillas/cliente/linea-de-tiempo.md` si falta):
   `<hoy> · entregable_creado · [[<archivo sin .md>]] <recurrente_de> vence <vence> · <persona>`
   Por cada eliminado: `<hoy> · estado · [[<archivo sin .md>]] eliminado: ya no está en el plan · <persona>`.
4. Bitácora de sesión según `CLAUDE.md` § Antes de terminar, con los clientes que cambiaron.
5. Reporta por cliente: cuántos creados/eliminados, qué vence esta semana y quién lo hace. Como jefe
   de proyecto, avisa si alguien queda con más de 5 entregables en una semana y propone redistribuir o mover fechas.
   Si ningún cliente cambió, dilo en una línea y no escribas nada.
