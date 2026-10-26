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
2. Corre `uv run scripts/cliente.py <email>` **una vez por cada email** y junta los slugs distintos de `ninguno`.
3. Según el resultado:
   - **Ningún slug** → no escribas nada en ninguna parte (ni bandeja, ni bitácora, ni resumen en el
     chat del contenido). Responde solo: "Esta reunión no involucra a ningún cliente registrado; no la anoté." y termina.
   - **2 o más slugs distintos** (ambiguo) → crea solo `bandeja/YYYY-MM-DD-reunion-por-clasificar-<persona>.md`
     sin frontmatter, con: fecha, título, emails externos y los clientes candidatos. Nada del contenido.
     Pide al usuario que diga a qué cliente corresponde y termina.
   - **Exactamente 1 slug** → ese es el cliente `<c>`. Sigue.

## 2. Lee el cliente

Lee `clientes/<c>/_ficha.md`, `contexto.md` y las promesas abiertas (`- [ ]`) de las actas en
`clientes/<c>/reuniones/`, y los entregables no `publicado`/`cancelado`.

## 3. Acta

- Si viene `granola_id`, busca con Grep `granola_id: "<id>"` en `clientes/<c>/reuniones/`. Si existe,
  **actualiza ese archivo** (y lo derivado) en vez de crear otro; no dupliques decisiones ni entregables.
- Si no existe, crea `clientes/<c>/reuniones/YYYY-MM-DD-<slug>.md` (fecha de la reunión, slug del título):

```markdown
---
tipo: reunion
cliente: <c>
fecha: YYYY-MM-DD           # o YYYY-MM-DDTHH:MM
asistentes: [<persona>, "ana@cliente.cl"]   # internos por slug, externos por email
fuente: granola             # granola | notas | transcripcion
granola_id: "<id>"          # solo si viene
---

## Resumen
<3-6 líneas: para qué fue y qué salió>

## Decisiones
- [[YYYY-MM-DD-<slug-decision>]] <una línea>

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
  `fecha`, `origen: "[[<archivo del acta sin .md>]]"`; cuerpo: qué se decidió, por qué, alternativas descartadas.
- **Cada promesa nuestra con fecha** → `clientes/<c>/entregables/<vence>-<slug>.md` con `tipo: entregable`,
  `cliente`, `formato` (slug corto: `propuesta`, `post-instagram`, `reporte`…), `vence`, `estado: brief`,
  `responsable` (quien prometió), `origen: "[[<acta>]]"`; cuerpo `## Brief` con lo pedido y `## Versiones` vacío.
  Las promesas del cliente y las nuestras sin fecha quedan solo en el acta (señálalas al cerrar).
- **Cada aprendizaje** → viñeta al final de `contexto.md › ## Lo que aprendimos`:
  `- YYYY-MM-DD: <aprendizaje> ([[<acta>]])`. Si `contexto.md` no existe, créalo desde `plantillas/cliente/contexto.md`.
- **Promesas previas cumplidas**: si en esta reunión se entregó o mostró algo prometido antes, marca
  `- [x]` en el acta anterior y, si tiene entregable, actualiza su `estado` (p. ej. `revision` o `aprobado`).
- **Línea de tiempo** (`clientes/<c>/linea-de-tiempo.md`, créala desde la plantilla si falta), una línea por evento al final:
  ```
  YYYY-MM-DD · reunion · [[<acta>]] <título> · <persona>
  YYYY-MM-DD · decision · [[<decision>]] <resumen> · <persona>
  YYYY-MM-DD · entregable_creado · [[<entregable>]] vence YYYY-MM-DD · <persona>
  YYYY-MM-DD · estado · [[<entregable>]] brief→revision · <persona>
  YYYY-MM-DD · aprendizaje · [[<acta>]] <resumen> · <persona>
  ```
  La fecha de cada línea es la de la reunión.

## 5. Cierre

1. `uv run scripts/validar.py` (sin rutas valida todo; con rutas, solo archivos `.md`, no carpetas) → corrige hasta que no imprima nada.
2. Bitácora de sesión según `CLAUDE.md` § Antes de terminar (`clientes: [<c>]`, skill `procesar-reunion`).
3. Responde como jefe de proyecto: lista de archivos creados/actualizados, promesas con responsable y
   fecha, promesas sin fecha o del cliente a seguir, y próximos pasos concretos con quién los hace.
