---
name: procesar-reunion
description: Procesa la transcripción o notas de una reunión (Granola, archivo .md o texto pegado) y la documenta en el cliente correcto - acta en reuniones/, decisiones, promesas convertidas en entregables, aprendizajes en contexto.md y línea de tiempo. Úsala cuando te pasen una transcripción, un resumen de reunión o te pidan "procesa/anota/documenta esta reunión", o al traer reuniones nuevas desde Granola.
---

# procesar-reunion

Entrada: ruta o texto de una transcripción, más metadatos (fecha, título, asistentes con email,
`granola_id` si viene de Granola). Si falta la fecha o los emails de los asistentes, pídelos; no adivines.
Persona = `$AOS_PERSONA`. Sigue las convenciones de `CLAUDE.md` (§ Dónde anotar qué, § Línea de tiempo).

## 1. Filtro de privacidad (antes de escribir NADA)

1. Extrae los emails pelados de los asistentes (`Ana <ana@x.cl>` → `ana@x.cl`).
2. Corre `uv run scripts/cliente.py <email> [<email>...]` con todos los emails.
3. Según lo que imprime:
   - **`ninguno`** → no escribas nada en ninguna parte (ni bandeja, ni bitácora, ni resumen en el
     chat del contenido). Responde solo: "Esta reunión no involucra a ningún cliente registrado; no la anoté." Si algún
     asistente externo tiene un dominio no genérico (no gmail.com y similares, no el de la agencia), agrega:
     "¿<dominio> es un cliente o prospecto nuevo? Si me dices que sí, lo registro y anoto la reunión."
     Con un sí, usa `nuevo-cliente` (prellenado desde la reunión) y vuelve al paso 1. Sin respuesta, termina.
   - **`ambiguo: <slug1>, <slug2>`** → escribe solo en `bandeja/YYYY-MM-DD-reunion-por-clasificar-<persona>.md`
     (sin frontmatter; si existe, agrega al final; no dupliques una entrada con la misma fecha + título):
     fecha, título, emails externos y los clientes candidatos. Nada del contenido.
     Pide al usuario que diga a qué cliente corresponde y termina.
   - **Un slug** → ese es el cliente `<c>`. Sigue.

## 2. Lee el cliente

Lee `clientes/<c>/_ficha.md`, `contexto.md` y las promesas abiertas (`- [ ]`) de las actas en
`clientes/<c>/reuniones/`, y los entregables no `publicado`/`cancelado`.

## 3. Acta

- Si viene `granola_id`, busca con Grep la regex `granola_id:.*<id>` en `clientes/<c>/reuniones/`. Si existe,
  **actualiza ese archivo** (y lo derivado) en vez de crear otro; no dupliques decisiones ni entregables.
- Si no hay match por `granola_id`, busca en `clientes/<c>/reuniones/` un acta `tipo: reunion` (p. ej. una
  creada antes desde Calendar con `fuente: notas`) con la misma fecha, hora de inicio ±15 min y al menos un
  email de asistente en común (los títulos de Calendar y Granola pueden diferir). Si existe, **mejórala**:
  agrega `granola_id`, cambia a `fuente: granola`, fusiona el contenido nuevo en sus secciones y actualiza lo
  derivado, sin duplicar decisiones, entregables ni líneas de `linea-de-tiempo.md` (la línea `reunion` ya está).
- Si no existe ninguna, crea `clientes/<c>/reuniones/YYYY-MM-DD-<slug>.md` (fecha de la reunión, slug del título):

```markdown
---
tipo: reunion
cliente: <c>
fecha: YYYY-MM-DDTHH:MM     # con hora de inicio si se conoce (la usa el dedup); si no, YYYY-MM-DD
asistentes: [<persona>, "ana@cliente.cl"]   # internos por slug, externos por email
fuente: granola             # granola | notas | transcripcion
granola_id: "<id>"          # solo si viene
---

## Resumen
<3-6 líneas: para qué fue y qué salió>

## Decisiones
- [[clientes/<c>/decisiones/YYYY-MM-DD-<slug-decision>]] <una línea>

## Promesas
- [ ] <persona>: <qué> (<YYYY-MM-DD>)

## Lo que aprendimos
- <aprendizaje>
```

Promesas: todo compromiso concreto, nuestro o del cliente. `<persona>` = slug de alguien del equipo
(ver `equipo/personas/`, o el nombre en minúsculas tal como aparece) o el nombre del contacto del cliente.
Fecha: la dicha en la reunión convertida a `YYYY-MM-DD`; si no se dijo, `(sin fecha)`.

## 4. Derivados

- **Cada decisión** → `clientes/<c>/decisiones/YYYY-MM-DD-<slug>.md` con `tipo: decision`, `cliente`,
  `fecha`, `origen: "[[clientes/<c>/reuniones/<acta sin .md>]]"`; cuerpo: qué se decidió, por qué, alternativas descartadas.
- **Cada promesa nuestra** (con o sin fecha) → `clientes/<c>/entregables/<vence>-<slug>.md` con `tipo: entregable`,
  `cliente`, `formato` (slug corto: `propuesta`, `post-instagram`, `reporte`…), `vence`, `estado: brief`,
  `responsable` (slug de quien prometió; si no queda claro quién, el `responsable` de la `_ficha.md` del cliente, y dilo al cerrar), `origen: "[[clientes/<c>/reuniones/<acta>]]"`; cuerpo `## Brief` con lo pedido y `## Versiones` vacío.
  Sin fecha dicha: `vence` = fecha de la reunión + 7 días y `fecha_tentativa: true` (el brief del día
  le pide al responsable confirmarla). Ninguna promesa nuestra queda solo en el acta.
  Las promesas del cliente (lo que nos debe: fotos, accesos, aprobaciones) quedan como `- [ ]` en el acta;
  el responsable del cliente las ve en su brief del día hasta que se cumplan.
- **Cada aprendizaje** → viñeta al final de `contexto.md › ## Lo que aprendimos`:
  `- YYYY-MM-DD: <aprendizaje> ([[clientes/<c>/reuniones/<acta>]])`. Si `contexto.md` no existe, créalo desde `plantillas/cliente/contexto.md`.
- **Promesas previas cumplidas**: si en esta reunión se entregó o mostró algo prometido antes, marca
  `- [x]` en el acta anterior y, si tiene entregable, actualiza su `estado` (p. ej. `revision` o `aprobado`).
- **Línea de tiempo** (`clientes/<c>/linea-de-tiempo.md`, créala desde la plantilla si falta), una línea por evento al final:
  ```
  YYYY-MM-DD · reunion · [[clientes/<c>/reuniones/<acta>]] <título> · <persona>
  YYYY-MM-DD · decision · [[clientes/<c>/decisiones/<decision>]] <resumen> · <persona>
  YYYY-MM-DD · entregable_creado · [[clientes/<c>/entregables/<entregable>]] vence YYYY-MM-DD · <persona>
  YYYY-MM-DD · estado · [[clientes/<c>/entregables/<entregable>]] brief→revision · <persona>
  YYYY-MM-DD · aprendizaje · [[clientes/<c>/reuniones/<acta>]] <resumen> · <persona>
  ```
  La fecha de cada línea es la de la reunión.

## 5. Cierre

1. `uv run scripts/validar.py` (sin rutas valida todo; con rutas, solo archivos `.md`, no carpetas) → corrige hasta que no imprima nada.
2. Bitácora de sesión según `CLAUDE.md` § Antes de terminar (`clientes: [<c>]`, skill `procesar-reunion`).
3. Responde como jefe de proyecto: lista de archivos creados/actualizados, promesas con responsable y
   fecha, promesas sin fecha o del cliente a seguir, y próximos pasos concretos con quién los hace.
