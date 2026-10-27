---
name: brief-reunion
description: Prepara a la persona para las reuniones con clientes de un día (por defecto mañana) - lee su Google Calendar, y por cada evento con asistentes externos de un cliente registrado crea o actualiza un brief en reuniones/ con el propósito, lo que sabemos, lo prometido y qué llevar. Úsala cuando pidan "prepárame las reuniones de mañana", "brief de la reunión con X" o en la pasada de la tarde.
---

# brief-reunion

Argumento opcional: fecha `YYYY-MM-DD` (default: mañana). Persona = `$AOS_PERSONA` (en pasadas
automáticas viene como argumento). Sigue `CLAUDE.md` (§ Dónde anotar qué, § Privacidad, § Línea de tiempo).

## 1. Eventos

Usa el conector de Google Calendar para listar los eventos de la persona en esa fecha. Si el conector
no está disponible o no responde, dilo en una línea ("No tengo acceso al Calendar; no preparé briefs.")
y termina sin escribir nada.

## 2. Filtro de privacidad (por evento, antes de escribir)

1. Extrae los emails pelados de los asistentes externos (los que no son del `dominio_email` de `marca/marca.md`).
2. Sin externos → ignora el evento, no lo menciones.
3. Corre `uv run scripts/cliente.py <email> [<email>...]`:
   - `ninguno` → ignóralo; no escribas nada en ninguna parte.
   - `ambiguo: ...` → escribe solo en `bandeja/YYYY-MM-DD-reunion-por-clasificar-<persona>.md` (sin frontmatter;
     si existe, agrega al final; no dupliques una entrada con la misma fecha + título) con fecha, título,
     emails y clientes candidatos; sin contenido. Sigue con el siguiente evento.
   - Un slug → ese es el cliente `<c>`.

## 3. Brief

Lee `_ficha.md`, `contexto.md`, `plan-contratado.md`, las actas recientes de `reuniones/` y los
entregables de `<c>`. Si `etapa: activo` y existe `metricas/`, toma la última; si no existe, omite esa parte sin avisar.

Archivo: `clientes/<c>/reuniones/YYYY-MM-DD-brief-<slug-del-titulo>.md`. Si ya existe un brief con esa
fecha para el mismo evento, **actualízalo** en vez de crear otro.

```markdown
---
tipo: brief-reunion
cliente: <c>
fecha: YYYY-MM-DDTHH:MM
asistentes: [<persona>, "ana@cliente.cl"]
fuente: calendar
link: "<url de la videollamada>"   # solo si el evento la trae
---

## Para qué es esta reunión
<objetivo según el título/descripción del evento y el momento del cliente>

## Lo que sabemos
<etapa, contexto relevante, últimas decisiones y aprendizajes; números de la última métrica si hay>

## Lo prometido y su estado
- <promesas `- [ ]` de actas previas y entregables abiertos, con estado y vence; marca los atrasados>

## Te propongo llevar
- <puntos concretos a mostrar, preguntar o proponer, derivados de lo anterior>
```

## 4. Cierre

1. `uv run scripts/validar.py <archivos .md>` → corrige hasta que no imprima nada.
2. Una línea en `linea-de-tiempo.md` solo si creaste el brief (no al actualizarlo):
   `YYYY-MM-DD · reunion · [[clientes/<c>/reuniones/<brief>]] brief de reunión · <persona>`.
3. Bitácora según `CLAUDE.md` § Antes de terminar (`clientes: [<slugs>]`).
4. Responde como jefe de proyecto: reuniones preparadas (hora, cliente), lo más urgente de cada una
   y quién hace qué antes de entrar.
