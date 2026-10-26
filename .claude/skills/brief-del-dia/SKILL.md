---
name: brief-del-dia
description: Arma el brief de la mañana de una persona - sus entregables que vencen en 7 días o están atrasados, promesas abiertas, reuniones de hoy y alertas de jefe de proyecto, con una propuesta concreta o borrador por cada pendiente. Úsala cada mañana, o cuando pidan "qué tengo hoy", "mi brief del día" o "qué está pendiente".
---

# brief-del-dia

Persona = `$AOS_PERSONA` (`printenv AOS_PERSONA`) o el argumento (`/brief-del-dia marketing`). Los archivos
de `bandeja/` van al nombre de esa persona, nunca a `ia`. Sigue `CLAUDE.md`. Hoy = fecha actual.

## 1. Reúne

Lee `clientes/*/entregables/`, `reuniones/` y `_ficha.md` de cada cliente (Glob + Grep). Cuenta:

- **Entregables**: `responsable` = persona o `ia`, `estado` ni `publicado` ni `cancelado`, y `vence` ≤ hoy+7
  días (los `vence` < hoy están **atrasados**). Ordénalos por `vence`.
- **Promesas abiertas** `- [ ]` de la persona en actas de los últimos 14 días.
- **Reuniones de hoy**: `tipo: brief-reunion` con `fecha` de hoy en `clientes/*/reuniones/`.
- **Señales**: más de 5 entregables de la persona en una misma semana (sobrecarga); `proximo_contacto`
  vencido en alguna ficha; cliente `activo` sin eventos en `linea-de-tiempo.md` hace 14 días o más.

Si no hay nada de lo anterior, dilo en una línea y no escribas nada.

## 2. Propuesta por pendiente

Cada entregable y cada promesa lleva una propuesta concreta, leyendo antes el cliente (`contexto.md`,
`plan-contratado.md`, `brandbook.md`, el `## Brief` del entregable): el siguiente paso con quién y
cuándo, o un **borrador** (copy, guion, mensaje) listo para editar. Lo dirigido a clientes
(correos, publicaciones, DMs) es solo borrador, jamás se envía. Para atrasados propone mover la fecha
o redistribuir, y dilo.

## 3. Escribe

`bandeja/YYYY-MM-DD-hoy-<persona>.md` (sin frontmatter; si existe, reemplázalo):

```markdown
# Hoy, <fecha> · <persona>

## Reuniones de hoy
- <hora> · [[clientes/<c>/reuniones/<brief>]] <cliente>

## Atrasado
- [[clientes/<c>/entregables/<entregable>]] · <cliente> · vencía <fecha>
  Propuesta: <paso concreto o borrador>

## Esta semana
- [[clientes/<c>/entregables/<entregable>]] · <cliente> · vence <fecha> · <estado>
  Propuesta: <paso concreto o borrador>

## Promesas abiertas
- <promesa> ([[clientes/<c>/reuniones/<acta>]])
  Propuesta: <...>

## Alertas de jefe de proyecto
- <sobrecarga, próximo contacto vencido, cliente sin actividad> → <acción propuesta>
```

Omite las secciones vacías. No cambies estados ni fechas por tu cuenta: solo propón.

## 4. Cierre

Si no tocaste `clientes/`, no hace falta bitácora. Resume en el chat lo más urgente (3-5 líneas) y los
próximos pasos con responsable, y la ruta de la bandeja.
