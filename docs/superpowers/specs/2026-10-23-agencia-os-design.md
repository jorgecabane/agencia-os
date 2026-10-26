# agencia-os — Diseño

> Fecha: 2026-10-23 · Autor: Jorge (con Claude) · Estado: borrador para aprobación

## 1. Qué es y por qué

Un sistema operativo para una agencia de marketing chica, **AI-native desde el inicio**: el equipo trabaja como hoy, conversando con Claude Code, y **como subproducto** de ese trabajo se documenta todo lo de cada cliente — decisiones, reuniones, promesas, entregables, materiales, métricas — en una fuente de verdad compartida que mejora con cada iteración.

**Por qué ahora:** están entrando clientes nuevos. Con los actuales (Donna's, Casa Pilates SD, Como el Musguito, Clima Simple, Noema…) todavía es manejable a mano y de memoria, pero no escala. Hoy los tres integrantes ya usan Claude, cada uno por su lado, y lo que aprende uno no le llega a los demás. El material (fotos, videos, castings, logos) está en Google Drive desordenado y cuesta aprovecharlo.

**Visión de largo plazo:** si funciona internamente, que sea un sistema **reutilizable y vendible** a otras agencias. Por eso nada específico de la agencia (marca, clientes, personas) va en el código: todo entra por onboarding.

### Equipo inicial
- Jorge — lidera, PM, hace estrategia/creatividad y opera con IA.
- 1 persona de marketing (puede crecer).
- 1 persona técnica (desarrollo).
Todos usan Claude Code y git.

## 2. Objetivos

1. **No se pierde nada**: cada reunión, promesa, decisión y entregable queda registrado en el cliente correcto, automáticamente.
2. **Saber en qué enfocarse**: qué cliente tiene qué entrega, cuándo y quién la hace — en una vista de calendario y kanban.
3. **Llegar preparado**: antes de cada reunión hay un brief armado solo (para qué es, qué prometimos, qué proponer).
4. **Proponer, no solo registrar**: el sistema sugiere próximos pasos, detecta efecto dominó al mover fechas, propone mejoras según métricas.
5. **Automatizar lo repetitivo**: entregables recurrentes, métricas semanales, reportes, sincronización con herramientas de clientes.
6. **Aprender solo**: detecta trabajo repetido → crea skills; detecta correcciones → mejora skills y el contexto del cliente.
7. **Compartido**: lo que hace uno le llega a todos sin pasos manuales.

### Criterio de éxito del piloto (Donna's, 3 semanas)
- Ninguna promesa hecha en reunión se pierde: toda queda como pendiente/entregable con responsable y fecha.
- Hay brief antes de cada reunión con Donna's.
- Cada persona ve sus entregables y pendientes con fecha (vista "Lo mío" + brief del día), y el sistema la ayuda a ejecutarlos y le propone próximos pasos.
- La persona de marketing lo usa a diario sin ayuda.

## 3. No-objetivos (fase 1)

- Panel web propio (Vercel). Se retoma cuando Obsidian quede corto (link compartible, vistas para clientes).
- Mover archivos pesados fuera de Drive. Drive sigue siendo el almacén; el repo guarda un índice.
- Publicar en redes, enviar correos a clientes o gastar en ads sin aprobación humana.
- Un CRM tradicional con base de datos (Twenty, NocoBase, etc.). Se evaluaron y descartaron (ver §13).

## 4. Anti-objetivos (sería un fracaso aunque "funcione")

- Que mantener el sistema sea más trabajo que el que ahorra.
- Que haya **dos fuentes de verdad** que se desincronicen (repo vs. otra base de datos).
- Que el agente haga algo **hacia afuera** (cliente, redes, plata) sin que un humano lo decida.
- Que el conocimiento quede encerrado en un documento generado (un ppt) y no vuelva a la base del cliente.
- Que algo dependa de que el notebook de alguien esté prendido.

## 5. Arquitectura

```
                  ┌──────────────────────────────────────────┐
  Fuentes         │  Repo git privado (GitHub) = VERDAD       │        Vistas
  ─────────       │  markdown + frontmatter YAML              │        ──────
  Granola ───┐    │                                           │   ┌─ Obsidian (Bases:
  Calendar ──┤    │  clientes/  bandeja/  vistas/  marca/     │   │   calendario, kanban,
  Gmail ─────┼──▶ │  equipo/  sesiones/  .claude/skills/      │ ──┤   tablas, grafo)
  Drive ─────┤    │                                           │   └─ (futuro) panel Vercel
  Meta/GA4/  │    └──────────────▲────────────────┬───────────┘
  GAds/Shopify    escriben:      │                │ sincroniza (escribe solo):
             │    · Claude Code (cada persona,    │   ClickUp de Donna's,
             │      conversando + hooks)          ▼   otras herramientas de clientes
             └──▶ · Agentes programados en la nube
```

**Principios:**
- **El repo es la única fuente de verdad.** Todo lo demás (Obsidian, ClickUp, futuro panel) lee o se sincroniza desde él.
- **Texto plano**: markdown + frontmatter YAML. Lo leen humanos, Claude, Obsidian, Graphify y cualquier herramienta futura.
- **Git es el bus de sincronización y el historial**: todo cambio es un commit, todo se puede revertir.
- **El agente aplica cambios internos solo**; lo que sale hacia afuera sigue las reglas de §9.

## 6. Estructura del repo

```
agencia-os/
├── CLAUDE.md                  # reglas de operación: dónde anotar qué, convenciones
├── marca/                     # identidad de la agencia (se llena en setup)
│   ├── marca.md               # nombre, tono, reglas
│   ├── tokens.yaml            # colores, tipografías, espaciados
│   └── assets/                # logos (livianos); pesados → link a Drive
├── clientes/
│   └── <cliente>/
│       ├── _ficha.md          # etapa, modalidad, responsables, próximo contacto, conectores
│       ├── contexto.md        # negocio, producto, audiencia, competencia, "lo que aprendimos"
│       ├── brandbook.md       # resumen + links al brandbook real
│       ├── plan-contratado.md # lo vendido: ítems recurrentes y/o hitos
│       ├── material.md        # índice del material en Drive
│       ├── reuniones/         # YYYY-MM-DD-<slug>.md (briefs y actas)
│       ├── entregables/       # YYYY-MM-DD-<slug>.md (uno por entregable)
│       ├── decisiones/        # YYYY-MM-DD-<slug>.md
│       ├── metricas/          # YYYY-Www.md (snapshots semanales)
│       ├── reportes/          # ppt/pdf generados + nota .md con conclusiones
│       └── linea-de-tiempo.md # eventos tipados, append-only
├── bandeja/                   # propuestas del agente + "Lo que cambié" diario
├── sesiones/                  # bitácora de cada sesión de trabajo con Claude
├── equipo/
│   ├── personas/<nombre>.md   # rol, clientes, preferencias, rutinas
│   └── skills.md              # índice generado de skills: qué hacen, deps, versión
├── vistas/                    # archivos .base de Obsidian (hoy, calendario, kanban, pipeline, lo mío)
├── plantillas/
│   └── skills/<tipo>/         # bases para skills creadas por onboarding (ver §10)
├── .claude/
│   ├── skills/                # skills del equipo (compartidas vía git)
│   ├── commands/              # /bienvenida, /setup-espacio, /nuevo-cliente…
│   ├── hooks/                 # scripts de hooks
│   └── settings.json          # hooks + MCPs de proyecto
├── .obsidian/                 # config compartida: plugins + ajustes (workspace.json ignorado)
└── docs/
```

Archivos pesados (videos, fotos originales) **nunca** al repo.

### 6.1 Reutilizable sin desacoplar
Un solo repo. Para que otra agencia lo use: se mantiene una **versión plantilla** (repo template de GitHub) que es el repo **antes de poblarlo** — solo producto: `CLAUDE.md`, `.claude/`, `plantillas/`, `vistas/`, `.obsidian/`, `docs/`. Otra agencia hace fork/usa la plantilla y corre `/setup-espacio`.
Regla que lo hace posible: **los datos de la agencia viven solo en** `marca/`, `clientes/`, `equipo/`, `sesiones/`, `bandeja/`; nada de eso se referencia por nombre desde las carpetas de producto.
*ponytail:* las mejoras al producto se llevan a la plantilla copiando esas carpetas a mano; si se vuelve frecuente, automatizarlo o pasar a plugin.

## 7. Modelo de datos

Inspirado en lo rescatable de los CRMs (timeline de Twenty/Monica, estados tipados, objetos con esquema, relaciones por ID). Cada entidad es un archivo con `tipo:` en el frontmatter. IDs = slug del archivo; las relaciones son `[[wikilinks]]`.

### Cliente (`_ficha.md`)
```yaml
tipo: cliente
nombre: Donna's Pet Boutique
slug: donna
etapa: activo            # prospecto | propuesta | activo | pausado | cerrado
modalidad: retainer      # retainer | proyecto | mixto
responsable: jorge
equipo: [jorge, marketing]
dominios_email: [donnapet.cl]   # para reconocer reuniones/correos
proximo_contacto: 2026-10-28
drive: https://drive.google.com/...
conectores:
  - tipo: clickup
    espacio: "<id>"
    modo: bidireccional
fuentes_metricas: [meta_ads, instagram, ga4, google_ads, shopify]
```

### Plan contratado (`plan-contratado.md`)
```yaml
tipo: plan
cliente: donna
vigente_desde: 2025-11-01
recurrentes:
  - nombre: Post feed
    formato: post-instagram
    cada: [mar, jue, sab]
    responsable: marketing
    skill: post-instagram
  - nombre: Reporte semanal
    formato: reporte
    cada: lun
    responsable: ia
hitos:                    # para modalidad proyecto
  - nombre: Brandbook v1
    vence: 2026-10-31
```
El cuerpo describe en prosa lo vendido (alcance, precio, condiciones).

### Entregable
```yaml
tipo: entregable
cliente: donna
formato: carrusel-instagram
vence: 2026-10-30
estado: revision         # brief | en_curso | revision | aprobado | publicado | cancelado
responsable: jorge       # persona o "ia"
origen: "[[2026-10-21-reunion-coleccion]]"   # reunión, plan o decisión que lo generó
recurrente_de: "Post feed"   # si vino de una regla recurrente
skill: instagram-carrusel
clickup_id: "abc123"     # si está espejado
depende_de: ["[[2026-10-25-sesion-fotos]]"]   # opcional; ver §8.4
material: [ "https://drive.google.com/..." ]
```
Cuerpo: brief, versiones y feedback.

### Reunión
```yaml
tipo: reunion            # o brief-reunion
cliente: donna
fecha: 2026-10-22T10:00
asistentes: [jorge, "ana@donnapet.cl"]
fuente: granola
granola_id: "..."
```
Cuerpo: resumen, decisiones (link a `decisiones/`), promesas (checklist con responsable y fecha), "lo que aprendimos".

### Decisión
`tipo: decision`, `cliente`, `fecha`, `origen`, cuerpo: qué se decidió, por qué, alternativas descartadas.

### Línea de tiempo (`linea-de-tiempo.md`)
Una línea por evento, append-only: `2026-10-30 · reprogramado · [[carrusel-lanzamiento]] 27→30 · jorge`. Tipos: reunion, decision, entregable_creado, estado, reprogramado, publicado, metrica, aprendizaje, conector.

### Métricas (`metricas/2026-W43.md`)
Frontmatter con KPIs numéricos por fuente (seguidores, alcance, gasto, ROAS, sesiones, conversión, ventas); cuerpo con lectura y conclusiones. Las conclusiones relevantes se copian a `contexto.md › lo que aprendimos`.

### Validación
Un esquema por `tipo` (en `plantillas/esquemas/`) que un hook verifica al escribir. Frontmatter inválido → Claude lo corrige antes de commitear. El mismo esquema servirá al futuro panel web.

## 8. Flujos

### 8.1 Trabajo diario conversando
1. La persona abre Claude Code en el repo (terminal o panel dentro de Obsidian).
2. Pide algo: "armemos los posts de noviembre de Donna's".
3. Claude lee ficha, contexto, brandbook, plan y material del cliente, usa la skill que corresponda y produce.
4. Siguiendo `CLAUDE.md`, anota en el cliente: entregables creados/actualizados, decisiones, eventos en la línea de tiempo, aprendizajes en `contexto.md`.
5. **Hook al terminar** (`Stop`/`SessionEnd`): escribe `sesiones/<fecha>-<persona>-<slug>.md` con `clientes: [...]` en el frontmatter (una sesión puede tocar varios) (qué se hizo, skill usada, correcciones), valida frontmatter, hace commit + pull --rebase + push.

### 8.2 Agente recolector (programado, nube)
Cada mañana (~07:00) y cada ~2 h en horario laboral:
- **Granola** (de cada integrante): nuevas transcripciones → identifica cliente por asistentes/dominio (dominios genéricos como gmail.com se resuelven por email exacto registrado en la ficha; si no calza con ningún cliente → `bandeja/` para triage, *decisión mía*) → crea acta en `reuniones/`, extrae promesas → entregables/pendientes, decisiones → `decisiones/`, aprendizajes → `contexto.md`.
- **Calendar**: reuniones próximas → a las 18:00 genera `brief-reunion` para el día siguiente (para qué es, qué prometimos mostrar y su estado, qué sabemos, qué proponer). Prospectos incluidos.
- **Gmail**: hilos con dominios de clientes → promesas/pedidos/aprobaciones relevantes a la línea de tiempo y pendientes.
- **Conectores** (ClickUp, etc.): trae cambios del cliente; empuja los nuestros.
- **Brief de la mañana** en `bandeja/YYYY-MM-DD-hoy.md`: qué vence esta semana, lo prometido ayer, digest de ClickUp, propuestas.

### 8.3 Recurrentes
Cada lunes el agente lee las reglas `recurrentes` de cada plan y **materializa** los entregables de las próximas 4 semanas como archivos normales (cada uno movible e iterable por separado). Si cambia la regla, ajusta solo los futuros con `estado: brief` que nadie ha tocado.

### 8.4 Calendario: mover e iterar
- Arrastrar una tarjeta en el calendario de Obsidian reescribe `vence:` en el archivo; Obsidian Git sincroniza.
- El agente, en la pasada siguiente, ve el cambio en git → lo anota en la línea de tiempo y revisa **efecto dominó** sobre los entregables con `depende_de` apuntando al movido. Las dependencias las pone quien crea el entregable (normalmente el agente: las skills y reglas recurrentes declaran cadenas típicas, p. ej. sesión de fotos → post). *Decisión mía:* si la dependencia es explícita y el dependiente quedaría antes que su prerequisito, lo corre automáticamente el mismo delta; cualquier otro caso se propone en la bandeja.
- Click en la tarjeta abre la nota; se itera con Claude desde el panel lateral.

### 8.5 Métricas y reportes semanales
- Cada lunes: para cada cliente con `fuentes_metricas`, obtiene números de la semana (Meta Ads + Instagram, GA4, Google Ads, Shopify) → `metricas/YYYY-Www.md`.
- Analiza vs. semana y período anteriores → conclusiones y propuestas (p. ej. "reel de casting convirtió 2x, repetir formato") → `contexto.md` y bandeja.
- Si el plan incluye reporte: genera ppt con la skill `reporte-ppt` (marca de la agencia) → `reportes/`, + nota `.md` con conclusiones para que el conocimiento quede referenciable.

### 8.6 Material en Drive
Agente que recorre la carpeta Drive de cada cliente y mantiene `material.md`: qué es cada pieza, campaña/evento, tipo, descripción (mirando imágenes), link. No mueve ni modifica nada en Drive. Corre al hacer onboarding del cliente y luego semanalmente sobre lo nuevo.

### 8.7 Aprendizaje continuo (estilo Hermes Agent)
Reflexión nocturna:
1. Lee `sesiones/` del día de todo el equipo + cambios en git.
2. Detecta: trabajo repetido (2ª vez que se hace algo a mano), correcciones repetidas a una skill o a un tono, fallas de skills, datos nuevos de clientes.
3. **Aplica solo**: crea skill nueva (desde plantilla + evals, ver §10), mejora skill existente (nueva versión con changelog), actualiza `contexto.md`, re-genera Graphify y `equipo/skills.md`.
4. Deja `bandeja/YYYY-MM-DD-lo-que-cambie.md` con todo lo aplicado y cómo revertirlo.

**También en vivo, dentro de la sesión:** si en la conversación aparece algo que ya se habló o hizo antes (Claude lo ve en `sesiones/` y Graphify), lo dice en el momento y **ofrece convertirlo en skill** ahí mismo ("es la 3ª vez que armamos un brief de casting; ¿lo dejo como skill?").

### 8.9 Postura: jefe de proyecto de la agencia
Regla central de `CLAUDE.md`: el agente actúa como **jefe de proyecto** de la compañía, no como asistente que espera instrucciones. En cada sesión y en cada pasada automática:
- Cierra con próximos pasos concretos y quién los hace.
- Avisa lo que vence, lo atrasado y lo prometido sin cumplir, aunque nadie pregunte.
- Detecta sobrecarga (alguien con demasiados entregables en la semana) y propone redistribuir o mover fechas.
- Propone mejoras al cliente desde los datos (métricas, feedback, aprendizajes).
- Propone mejoras a cómo opera el equipo (procesos repetidos → skill, pasos manuales → automatización).

### 8.8 Prospectos y pipeline
Un prospecto es un cliente con `etapa: prospecto`; misma carpeta, misma estructura. Pasa por `propuesta` → `activo` sin migrar nada. Vista kanban por etapa.

## 9. Reglas de autonomía

| Acción | Autonomía |
|---|---|
| Escribir/editar en el repo (actas, entregables, contexto, skills, fechas) | **Automática** |
| Sincronizar con herramientas de clientes (ClickUp: estados, fechas, comentarios, tareas) | **Automática** (pedido explícito de Jorge) |
| Enviar correos a clientes, publicar en redes, responder DMs, crear/activar/gastar en ads | **Requiere aprobación humana** — el agente deja el borrador listo |
| Borrar archivos de clientes o material en Drive | **Nunca** automático |

Resguardos: todo cambio es un commit con autor `agente` y mensaje descriptivo; resumen diario "Lo que cambié"; cualquier cosa se revierte con git.

### 9.1 Privacidad de cuentas personales
Cada integrante puede usar su correo y calendario principal, así que el filtro va **antes** de escribir nada al repo (un push no se des-ve):
- Solo se procesan reuniones, transcripciones y correos donde participe alguien registrado en la ficha de un cliente o prospecto (`dominios_email` o emails exactos).
- Todo lo demás se ignora y no se escribe en ninguna parte, ni en la bandeja. Nunca: 1:1 internas, temas personales, sueldos, precios internos.
- La excepción es lo que calza parcialmente (p. ej. un email nuevo con dominio de cliente): eso sí va a la bandeja de **su propio dueño** con lo mínimo para decidir.
- Cada persona da consentimiento explícito durante `/bienvenida` y puede excluir remitentes, etiquetas o calendarios.

## 10. Skills

Skills en `.claude/skills/` (compartidas vía git), cada una con `SKILL.md`, dependencias declaradas (MCPs, CLIs), versión y changelog. `equipo/skills.md` es el índice generado. **Las skills son genéricas; lo específico de cada cliente es data** (contexto, brandbook, estilo en su carpeta), así no se duplican skills por cliente.

Todas se crean y mejoran con el **skill-creator de Anthropic** (borrador → evals con prompts de prueba → benchmark → ajuste de descripción), envuelto en nuestra skill `crear-skill` que agrega las convenciones del repo.

### 10.1 Disponibles desde el día 1 (vienen con agencia-os)

**Operación del sistema**
| Skill / comando | Qué hace |
|---|---|
| `/setup-espacio` | Onboarding de la agencia (una vez): marca, repo, automatizaciones, genera skills de marca |
| `/bienvenida` | Onboarding de cada integrante: quién es, MCPs personales, Obsidian, rutinas, prueba final |
| `/nuevo-cliente` | Entrevista + docs → crea carpeta, ficha, contexto, plan, conectores, indexa Drive |
| `procesar-reunion` | Transcripción → acta, promesas, decisiones, aprendizajes |
| `brief-reunion` | Prepara reunión próxima (prospecto o activo) |
| `brief-del-dia` | Por persona: sus entregables y pendientes con fecha, lo prometido, digest de conectores, y para cada pendiente una propuesta concreta de cómo avanzarlo (o un borrador ya hecho) |
| `materializar-recurrentes` | Reglas del plan → entregables de las próximas 4 semanas |
| `sync-conector` | Sincroniza con ClickUp (y futuras herramientas de clientes) |
| `metricas-semanales` | Trae números de fuentes → `metricas/` + análisis |
| `indexar-material` | Drive → `material.md` |
| `reflexion` | Aprendizaje nocturno (§8.7) |
| `crear-skill` | Skill-creator + convenciones del repo |

**Oficio de marketing (base genérica, buena calidad, sin marca)**
| Skill | Qué hace |
|---|---|
| `brief-creativo` | Estructura un brief a partir del contexto del cliente |
| `calendario-contenido` | Propone calendario mensual según plan, fechas relevantes y métricas |
| `post-instagram` | Copy + caption + hashtags + brief visual (post, carrusel, reel) usando brandbook del cliente |
| `brandbook-cliente` | Construye brandbook para cliente nuevo (estructura estándar: posicionamiento, verbal, visual) |
| `propuesta-comercial` | Propuesta para prospecto con casos y planes |
| `analisis-growth` | Lee métricas → diagnóstico y recomendaciones |

### 10.2 Creadas en onboarding (dependen de la marca de la agencia)
Generadas por `/setup-espacio` a partir de `marca/` + una **plantilla base** en `plantillas/skills/<tipo>/` (estructura, ejemplos, evals) — nunca desde cero:

| Skill | Base |
|---|---|
| `reporte-ppt` | skill `pptx` de Anthropic + plantilla de reporte (portada, KPIs, gráficos estándar, conclusiones, próximos pasos) + convenciones de visualización |
| `excel-marca` | skill `xlsx` de Anthropic + formatos de tabla de la marca |
| `doc-marca` | skills `docx`/`pdf` de Anthropic, para propuestas y contratos |
| `video-marca` | plantilla de intro/outro/subtítulos con la marca (herramienta a definir en implementación; ver §14) |

### 10.3 Creadas por el uso
Las detecta y crea `reflexion` (p. ej. `respuesta-dm`, `guion-evento`, `brief-casting`), siempre vía `crear-skill`.

## 11. Integraciones (MCPs y APIs)

| Integración | Para qué | Alcance | Notas |
|---|---|---|---|
| Granola | Transcripciones | Por persona | Verificar MCP/API disponible y acceso desde la nube |
| Google Calendar | Reuniones, briefs | Por persona | |
| Gmail | Promesas, pedidos, aprobaciones | Por persona | Solo lectura en fase 1 |
| Google Drive | Índice de material | Agencia | Solo lectura |
| ClickUp | Espejo de tareas de Donna's | Por cliente | MCP oficial (beta, OAuth); límites de llamadas bajos en plan gratis → sincronizar por lotes |
| Meta Ads + Instagram | Métricas, ads | Por cliente | MCP oficial (beta); lo que crea queda pausado |
| Google Ads | Métricas | Por cliente | MCP oficial solo lectura (verificar) |
| GA4 | Métricas | Por cliente | Verificar MCP oficial vs comunitario |
| Shopify | Ventas | Por cliente | API admin vía MCP o script corto |
| Graphify | Grafo de conocimiento | Repo | Hook PreToolUse para consultar el grafo antes de leer archivos |

Credenciales: nunca en el repo. Locales en el keychain/config de cada persona; nube en los secretos del entorno de agentes programados.

### 11.1 Dónde corre y quién paga
Cada persona controla su propio uso según su plan de Claude (Jorge: plan de $100; otros: $20).
- **Tareas personales** (recolectar su Granola/Calendar/Gmail, su brief del día, briefs de sus reuniones) corren con la cuenta de cada persona.
- **Tareas de la agencia** (métricas semanales, recurrentes, reflexión nocturna, índice de Drive, conectores) corren con la cuenta de Jorge.
- Cada persona tiene en `equipo/personas/<nombre>.md` un `nivel_automatizacion: alto | medio | bajo`. **Se parte en alto** y se baja si se topa con límites. Cada nivel define frecuencias:

| Tarea | alto | medio | bajo |
|---|---|---|---|
| Recolección (Granola/Gmail/Calendar) | cada 2 h hábil | 2 veces al día | 1 vez al día |
| Brief del día | diario | diario | diario |
| Briefs de reunión | todas | todas | solo clientes activos |

- Las tareas de agencia también tienen nivel (en `marca/` o config del espacio); el índice de Drive con descripción de imágenes corre al dar de alta un cliente y luego solo sobre lo nuevo.

## 12. Vista: Obsidian

Obsidian abre el repo como bóveda. No agrega base de datos: solo `.obsidian/` (config), archivos `.base` (vistas, YAML) y wikilinks.

**Plugins (mínimos):**
- **Bases** (core): tablas editables tipo Notion, kanban nativo (v1.14+).
- **Obsidian Git**: pull/commit/push automático cada pocos minutos.
- **Kanban Bases View**: carriles por persona (columnas = estado, filas = responsable).
- **Yabacavi** o **Calendar Bases**: calendario sobre Bases con drag & drop que reescribe la fecha (hasta que salga el calendario nativo).
- **Panel de Claude Code** (Agent Sidebar / GuKi Chat o similar): conversar desde la nota abierta. Son plugins nuevos y poco usados; la terminal es el respaldo.

**Vistas iniciales** (`vistas/`): `hoy`, `calendario`, `entregables` (kanban por estado), `equipo` (kanban con carriles por persona), `lo-mio`, `pipeline` (kanban por etapa), `clientes` (tabla).

## 13. Alternativas evaluadas

- **CRMs open source** (Twenty, ERPNext, Huly, Monica, NocoBase): todos guardan en su propia base de datos; usarlos crea dos fuentes de verdad. Se rescató su modelo conceptual (timeline, estados, esquemas, vistas guardadas, próximo contacto). Twenty/NocoBase tienen MCP oficial si en el futuro se quiere un espejo.
- **AppFlowy / AFFiNE**: formato propio (CRDT), markdown solo import/export. Descartados.
- **Notion**: buenas tablas, pero sería segunda fuente de verdad; Bases cubre el caso.
- **Panel propio en Vercel**: viable (2–4 días para MVP solo lectura), pospuesto a cuando se necesite link compartible o vistas para clientes.
- **harness2 (Google Research)**: framework de investigación para optimizar harnesses contra benchmarks; no aplica directo. Se toma la idea (mejorar el sistema, no el modelo).

## 14. Fases

**Fase 1 — Base + piloto Donna's**
Repo y estructura, `CLAUDE.md`, esquemas, hooks de sesión (bitácora + validación + git sync), Obsidian con plugins y vistas, `/setup-espacio` (versión mínima: marca + repo), `/bienvenida`, `/nuevo-cliente`, Granola + Calendar + Gmail → actas, promesas, briefs de reunión y brief del día, recurrentes, migración de Donna's (contexto, plan, material de Drive).

**Fase 2 — Números y conectores**
Métricas semanales (Meta, IG, GA4, Google Ads, Shopify), `analisis-growth`, skills de marca generadas en setup (`reporte-ppt` primero), ClickUp bidireccional.

**Fase 3 — Aprendizaje**
`sesiones/` → `reflexion` nocturna, `crear-skill` con skill-creator, Graphify, "Lo que cambié".

**Fase 4 — Escala**
Resto de clientes, onboarding pulido para terceros, preparación para reutilizar/vender; evaluar panel Vercel.

## 15. Qué queda para quien construye

- Mecanismo de los agentes programados (recomendado: agentes programados de Claude Code en la nube, cada uno en la cuenta que indica §11.1) y verificar qué conectores (Granola, Gmail, Calendar, Meta…) están disponibles en ese entorno; si alguno no lo está, definir el respaldo.
- Mecanismo exacto de hooks (`Stop` vs `SessionEnd`) y manejo de conflictos de git entre personas y agente.
- Herramienta de video para `video-marca`.
- Formato exacto de esquemas y cómo se validan.
- Contenido de las plantillas de skills y sus evals.
- Estado real (oct 2026) de cada MCP de §11.
