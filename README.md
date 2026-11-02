# agencia-os

El sistema operativo de una agencia de marketing. Tú conversas con Claude y él deja todo documentado en el cliente correcto: reuniones, decisiones, promesas, entregables y lo que vamos aprendiendo. Una app de escritorio muestra el día a día (Hoy, Tablero, Calendario, Clientes, Equipo) sin abrir la terminal.

## Cómo funciona

- **Todo vive en un repo de GitHub privado de tu agencia**, como archivos de texto (markdown). Es la única fuente de verdad: no hay base de datos aparte.
- **Claude es el jefe de proyecto.** Trabajas con él en la app de Claude (pestaña **Code**), en la terminal o en el chat de la app de agencia-os. Le cuentas algo ("Paula pidió mover los posts al viernes") y él lo anota donde corresponde, crea las tareas y te avisa lo que vence.
- **El equipo se sincroniza solo.** Después de cada respuesta de Claude, y cada vez que guardas algo en la app, los cambios se suben y se traen los del resto.
- **La recolección es automática.** Una tarea programada en la nube revisa tu Gmail, Calendar y Granola, guarda solo lo que involucra a un cliente registrado, procesa las reuniones y te arma el brief del día.
- **Nada sale hacia afuera sin un humano.** Correos, posts y DMs quedan como borrador en **Aprobaciones** hasta que alguien los apruebe.

Hay dos repos. Este es el **producto**: skills, app y reglas. Cada agencia tiene **su propio repo** con sus datos, y trae las mejoras del producto con `git pull producto main`. El producto nunca recibe datos de clientes: el sync lo bloquea.

## Empezar una agencia nueva (una sola vez, quien la dirige)

**Necesitas:**
- un Mac con Apple Silicon (M1 o posterior);
- una cuenta de Claude (Pro o Max) y la app de Claude instalada;
- una cuenta de GitHub con acceso a este repo (pídele a Jorge que te invite);
- `git`, que viene en el Mac (si te lo pide, acepta instalar las herramientas de desarrollo).

1. **Instala GitHub CLI e inicia sesión.** En la Terminal:
   ```
   brew install gh    # o descárgalo de https://cli.github.com
   gh auth login
   ```
2. **Copia el producto en una carpeta nueva** con el nombre de tu agencia:
   ```
   gh repo clone jorgecabane/agencia-os ~/mi-agencia-os
   ```
3. **Abre esa carpeta con Claude.** Puedes hacerlo en la app de Claude (pestaña **Code** → abrir carpeta) o con `cd ~/mi-agencia-os && claude` en la terminal.
4. **Escribe `/setup-espacio`.** Te pregunta el nombre de la agencia, el dominio de correo y la marca (logo, colores, brandbook). Después crea **el repo privado de tu agencia** en tu GitHub. Antes de crearlo te pide confirmación.
5. **Escribe `/bienvenida`.** Esto hace varias cosas:
   - crea tu ficha en el equipo;
   - te pide consentimiento para leer tu correo y calendario (con reglas claras de qué guarda y qué no);
   - te guía para conectar Gmail, Calendar, Drive y Granola en claude.ai → Connectors;
   - crea tu tarea de recolección con `/schedule`;
   - termina con tu primer brief del día.
6. **Registra cada cliente con `/nuevo-cliente`.** Te entrevista y crea su carpeta con:
   - ficha, contexto, plan contratado y brandbook;
   - el índice de su material en Drive;
   - los entregables recurrentes del plan.
7. **Instala la app.** Baja `agencia-os.zip` desde [Releases](https://github.com/jorgecabane/agencia-os/releases), muévela a Aplicaciones y la primera vez ábrela con clic derecho → **Abrir** → **Abrir** (no está firmada). Elige la carpeta de tu agencia y quién eres.
8. **Crea la tarea `recurrentes`** con `/schedule`, una sola vez. Cada lunes genera los entregables recurrentes de las próximas 4 semanas. Los detalles están en [docs/tareas-programadas.md](docs/tareas-programadas.md).

## Sumar a alguien al equipo

1. Invítalo como colaborador al **repo de tu agencia** (no a este).
2. Esa persona clona el repo de la agencia (`gh repo clone <tu-cuenta>/<agencia>-os`), lo abre con Claude y corre `/bienvenida`.
3. Instala la app (paso 7).

## Qué puede hacer

**En la app** ([docs/app.md](docs/app.md)):
- **Hoy:** lo que vence, tus reuniones, lo que llegó desde ayer (actas por confirmar) y lo que el cliente nos debe.
- **Tablero:** las tareas por estado. Desde aquí:
  - creas una tarea con "+";
  - el menú ⋯ mueve, asigna, reagenda, pone etiquetas o borra;
  - al abrir una tarea ves su checklist, su actividad y los comentarios con @menciones.
- **Calendario:** las entregas y reuniones del mes. Para crear una tarea en un día, usa "+" o haz doble clic.
- **Clientes:**
  - resumen, entregables abiertos y cerrados, y reuniones próximas y pasadas;
  - decisiones, contexto y brandbook;
  - alerta cuando llevas más de 14 días sin hablar con el cliente.
- **Aprobaciones:** los borradores hacia afuera, para aprobar o corregir.
- **Equipo:** la carga de la semana de cada persona, con aviso de sobrecarga.
- **Claude** al costado (⌘J) o a pantalla completa (⌘⇧J). Sabe en qué pantalla estás.
- **Atajos:** ⌘K busca o crea cualquier cosa y ⌘N crea una tarea. Cada atajo también tiene su botón.

**Conversando con Claude**, aunque no uses ninguna skill: "anota que…", "¿qué tengo hoy?", "crea una tarea para Cami el jueves", "prepárame la reunión con Donna's".

**Skills de la agencia** (se llaman escribiendo `/nombre`):

| Skill | Para qué |
|---|---|
| `/brief-del-dia` | Lo que vence en 7 días, promesas abiertas y reuniones de hoy, con una propuesta por pendiente |
| `/brief-reunion` | Prepara las reuniones con clientes de mañana |
| `/procesar-reunion` | Convierte una transcripción en acta, decisiones y tareas |
| `/recolectar` | La pasada de recolección (la corre la tarea programada) |
| `/nuevo-cliente` | Alta de un cliente o prospecto |
| `/indexar-material` | Índice del material del cliente en Drive |
| `/materializar-recurrentes` | Crea los entregables recurrentes del plan |

**Skills de marketing:**
- Instagram: `ig-*`, para posts, carruseles, reels, stories, respuestas y auditorías.
- Contenido y growth: copywriting, ads, SEO, CRO, emails, estrategia y más.
- Video: `hyperframes`.

La lista completa está en [docs/skills-externas.md](docs/skills-externas.md).

## Traer mejoras del producto

Desde la carpeta de tu agencia:

```
git pull producto main
```

La interfaz de la app llega con eso. Si la app avisa "Actualiza el marco", baja el último release y reemplázala.

## Más detalle

- [CLAUDE.md](CLAUDE.md): las reglas que sigue Claude y dónde se anota cada cosa.
- [docs/conectores.md](docs/conectores.md): conectores y cómo verificarlos.
- [docs/tareas-programadas.md](docs/tareas-programadas.md): la recolección en la nube.
- [docs/app.md](docs/app.md): la app de escritorio.
