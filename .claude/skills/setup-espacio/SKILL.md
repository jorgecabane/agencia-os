---
name: setup-espacio
description: Onboarding de la agencia, una sola vez - pregunta nombre, dominio de email y materiales de marca, crea marca/marca.md y marca/tokens.yaml, y (con tu confirmación explícita) crea el repo privado en GitHub. Corre solo con "/setup-espacio".
disable-model-invocation: true
---

# setup-espacio

Versión mínima de la fase 1. Habla en español de Chile (tú). Todo lo que sale del equipo (crear el repo,
hacer push) se confirma antes, uno por uno. Los datos de la agencia viven solo en `marca/`.

## 1. Revisa el punto de partida

- `ls marca/` : si ya existe `marca/marca.md`, muéstrala y pregunta si quieren actualizarla; no la pises sin permiso.
- `git remote -v` : si `origin` es el repo del producto (`jorgecabane/agencia-os`), este es una copia recién clonada: haz el paso 4. Si `origin` es otro repo, ya es el de la agencia: salta el paso 4.

## 2. Pregunta (una cosa a la vez)

1. Nombre de la agencia.
2. Dominio de email de la agencia, sin `@` (ej. `miagencia.cl`). Sirve para distinguir lo interno de lo externo en la recolección.
3. Logo, colores, tipografías y brandbook: archivos locales o links (Drive, Figma). Si no tienen algo, se deja vacío.

Si pasan archivos locales, no los copies al repo si son pesados (imágenes, PDF): guarda solo el link de Drive o la ruta. Pregunta dónde están en Drive.

## 3. Escribe `marca/`

`marca/marca.md` (sin `tipo`):

```markdown
---
nombre: <nombre de la agencia>
dominio_email: <dominio>
---

# <nombre>

## Tono y voz
<lo que cuenten; vacío si no dicen nada>

## Brandbook
<link o "pendiente">
```

`marca/tokens.yaml`:

```yaml
colores:
  primario: "#______"      # hex tal como los den; omite los que no tengan
tipografias:
  titulos: <nombre>
  texto: <nombre>
logo: <link a Drive>
brandbook: <link>
```

Si lees un brandbook, resume tono y voz en `marca.md` y colores/tipografías en `tokens.yaml`. No inventes valores.
Luego `uv run scripts/validar.py` (debe quedar en silencio).

## 4. Repo privado en GitHub (confirmación explícita)

1. `gh auth status`. Si no hay sesión, pídele que corra `gh auth login` y espera.
2. Propón el nombre del repo (slug de la agencia, ej. `<slug>-os`) y dile exactamente qué va a pasar:
   "Voy a crear un repo **privado** `<nombre>` con tu cuenta de GitHub y subir ahí este repo, incluida la
   carpeta `marca/`. El repo del producto queda conectado como `producto`, solo para traer mejoras; tus
   datos nunca van ahí. ¿Lo hago? (sí/no)"
3. Solo con un "sí" claro: haz commit de `marca/` (`feat: marca de <nombre>`); si `origin` es el producto,
   `git remote rename origin producto`; luego `gh repo create <nombre> --private --source . --push`.
   Con otra respuesta, no hagas nada y avisa que pueden hacerlo después.
4. No configures protección de ramas: el modo de trabajo es push directo a `main`.

## 5. Cierra

Resume qué se creó y recuerda lo que viene:
- Cada integrante corre `/bienvenida` en su máquina.
- Para cada cliente, `/nuevo-cliente`.
- Para traer mejoras del producto (skills, app): `git pull producto main`.
- Las skills de marca (generadas desde `marca/`) llegan en la fase 2; por ahora `marca/` solo guarda los datos.
