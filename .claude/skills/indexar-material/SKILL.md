---
name: indexar-material
description: Construye o actualiza clientes/<slug>/material.md, el índice del material del cliente en Google Drive (fotos, videos, logos, posts), agrupado por campaña, evento o tipo y con links. Solo lectura en Drive. Úsala al dar de alta un cliente, cuando pidan "indexa el material de <cliente>" o cuando falte material en el índice. Argumento - slug del cliente.
---

# indexar-material

Habla en español de Chile (tú). Sigue `CLAUDE.md` (§ Privacidad, § Línea de tiempo, § Antes de terminar). Argumento: `<slug>` del cliente; si falta, pídelo. Persona = `$AOS_PERSONA`.

## Reglas duras

- **Solo lectura en Drive.** Nunca muevas, renombres, edites ni borres nada allá.
- **Solo links.** Nunca descargues originales al repo ni guardes archivos pesados.
- Drive es un conector de claude.ai: usa las herramientas de Drive que tengas disponibles. Si no hay conector o no está autenticado, dilo, **no escribas nada** y pide a la persona que lo conecte.
- No indexes más de lo necesario para describir la pieza: no copies el texto de documentos ni datos personales.
- Salta lo que claramente no es de este cliente (carpetas personales, de otros clientes, internas de la agencia) y no lo escribas en ninguna parte.

## 1. Prepara

1. Lee `clientes/<slug>/_ficha.md`: el campo `drive` es la carpeta raíz. Si es `REEMPLAZAR` o está vacío, avisa y termina.
2. Lee `clientes/<slug>/material.md`. Si tiene `ultimo_indexado`, es una corrida incremental: solo agrega lo creado o modificado después de esa fecha y que no esté ya por link.

## 2. Recorre Drive

1. Parte desde la carpeta `drive` y baja por subcarpetas.
2. **Tope por corrida: 200 ítems** (archivos o carpetas leídos). Al llegar, detente, anota hasta dónde llegaste y cuántos faltan (aprox.), y deja `ultimo_indexado` en la fecha del último ítem procesado (orden por fecha de creación ascendente) para que la próxima corrida continúe desde ahí.
3. Por pieza reúne: nombre, tipo (`foto`, `video`, `logo`, `post`, `documento`), fecha (creación o la del evento), link.
4. **Fotos:** descríbelas mirando la miniatura o vista previa si el conector la ofrece (qué se ve, en 1 frase). Si no la ofrece, descríbelas por nombre y carpeta y marca `(sin vista previa)`.
5. Carpetas con muchos ítems parecidos van en una sola línea, con cantidad: `Casting sep — 48 fotos`.

## 3. Escribe `material.md`

Frontmatter: solo `ultimo_indexado: YYYY-MM-DDTHH:MM` (hora actual de America/Santiago). No agregues `tipo`.

Cuerpo: conserva la tabla de la plantilla (`Pieza | Tipo | Campaña / evento | Descripción | Link`). Una fila por pieza o carpeta, ordenadas por campaña/evento y luego tipo; agrupa con un `##` por campaña o evento si hay varios. En corridas siguientes agrega filas al grupo que corresponda; no reescribas ni borres las existentes. Si quedó material pendiente por el tope, agrega al final una línea `Pendiente: ~N ítems sin indexar (continuar con /indexar-material <slug>)`, reemplazando la anterior si existe.

## 4. Cierra

1. `uv run scripts/validar.py clientes/<slug>/material.md`: corrige hasta que no imprima nada.
2. Agrega a `clientes/<slug>/linea-de-tiempo.md`: `YYYY-MM-DD · estado · [[material]] indexadas N piezas (quedan M) · <persona>`.
3. Bitácora `sesiones/YYYY-MM-DD-<persona>-indexar-material-<slug>.md` según CLAUDE.md (§ Antes de terminar), si no la estás escribiendo ya en otra skill (ej. `nuevo-cliente`).
4. Resume: piezas agregadas, grupos, cuántas quedan por el tope y cuáles quedaron `(sin vista previa)`.
