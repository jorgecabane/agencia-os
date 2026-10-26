---
name: nuevo-cliente
description: Alta de un cliente o prospecto - entrevista, crea clientes/<slug>/ desde la plantilla, llena ficha, contexto, plan contratado y brandbook, indexa el material de Drive, materializa los recurrentes y valida. Corre solo con "/nuevo-cliente".
disable-model-invocation: true
---

# nuevo-cliente

Habla en español de Chile (tú). Sigue `CLAUDE.md` (§ Dónde anotar qué, § Privacidad). Persona = `$AOS_PERSONA`.

## 1. Entrevista (una cosa a la vez; acepta "no sé" y deja el campo vacío)

1. Nombre comercial. Slug = minúsculas, sin tildes, con guiones; confirma que `clientes/<slug>/` no exista.
2. Etapa: `prospecto`, `propuesta`, `activo`, `pausado` o `cerrado`.
3. Modalidad: `retainer`, `proyecto` o `mixto`.
4. Responsable: slug de alguien de `equipo/personas/` (o `ia`).
5. Dominios de email del cliente. Nunca `gmail.com` y similares: para esos, los emails exactos de cada contacto, con su rol.
6. Link de la carpeta de Drive.
7. Conectores (ej. ClickUp: espacio y modo) y fuentes de métricas (`meta_ads`, `instagram`, `ga4`, `google_ads`, `shopify`).
8. Lo contratado: recurrentes (nombre, formato, qué días: `lun mar mie jue vie sab dom`, responsable) y/o hitos con fecha; alcance y condiciones.

Si te pasan documentos (propuesta, brief, brandbook, links), léelos y úsalos para llenar lo anterior y el contexto; pregunta solo lo que falte. No copies archivos pesados al repo.

## 2. Crea la carpeta

`cp -R plantillas/cliente clientes/<slug>` y llena, reemplazando todos los valores de ejemplo (`Cliente Ejemplo`, `ejemplo.cl`, `REEMPLAZAR`, `cliente-ejemplo`):

- `_ficha.md`: frontmatter completo (`nombre, slug, etapa, modalidad, responsable` son obligatorios) y notas de contactos.
- `contexto.md`: negocio, producto, audiencia, competencia con lo que sepas; deja `## Lo que aprendimos` vacío.
- `plan-contratado.md`: `cliente: <slug>`, `vigente_desde` y `recurrentes`/`hitos` según lo contratado; alcance y condiciones en prosa. Si es solo proyecto, `recurrentes: []`.
- `brandbook.md`: resumen del brandbook y link al real; si no hay, deja la nota "pendiente".
- `material.md` y `linea-de-tiempo.md`: déjalos con su plantilla.

Agrega a `linea-de-tiempo.md` una línea: `YYYY-MM-DD · estado · [[_ficha]] cliente creado (etapa <etapa>) · <persona>`.

## 3. Indexa el material

Si hay link de Drive, invoca la skill `indexar-material` para `<slug>` (llena `material.md`). Si la skill aún no existe en el repo, dilo y deja `material.md` vacío; no inventes filas.

## 4. Recurrentes y validación

1. Si hay `recurrentes`, corre la skill `materializar-recurrentes` y muestra qué creó.
2. `uv run scripts/validar.py` : corrige hasta que no imprima nada.
3. Prueba el filtro de privacidad: `uv run scripts/cliente.py <un email del cliente>` debe imprimir `<slug>`.
4. Bitácora `sesiones/YYYY-MM-DD-<persona>-nuevo-cliente-<slug>.md` según CLAUDE.md (§ Antes de terminar).

## 5. Cierra

Resume lo creado, lo que quedó vacío por falta de datos y los próximos pasos con responsable (ej. completar el contexto en la primera reunión). El commit lo hace el hook de fin de sesión.
