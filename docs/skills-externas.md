# Skills externas

Copiadas tal cual desde su repo (sin modificar). Para actualizarlas, vuelve a copiar la carpeta desde
el commit nuevo y actualiza la tabla. Licencias en `licencias/`.

| Origen | Licencia | Commit | Activas en `.claude/skills/` |
|---|---|---|---|
| [Jakeschincariol/instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill) | MIT | `d03c56b` | las 13 `ig-*` |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Apache-2.0 | `c21a709` | `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `figma`, `remotion-to-hyperframes`, `slideshow` |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | `17772c7` | 19 de 51 (ver abajo) |

## Activas vs. biblioteca

Cada skill activa suma su descripción al contexto de **todas** las sesiones (y el plan de $20 lo nota),
así que solo están activas las que usa una agencia de contenido, growth y ads. El resto de
marketingskills (SaaS, B2B, pricing, revops…) espera en `biblioteca/skills/marketingskills/`.
Para activar una: `git mv biblioteca/skills/marketingskills/<skill> .claude/skills/`.

Activas de marketingskills: ad-creative, ads, analytics, copywriting, copy-editing, content-strategy,
social, emails, marketing-plan, marketing-ideas, marketing-psychology, cro, seo-audit, launch, events,
influencer-marketing, competitor-profiling, customer-research, video.

## Descartadas

- `dickwu/apple-design-skill`: el repo no tiene licencia (todos los derechos reservados), así que no se
  puede copiar a un repo que pensamos vender. Cada persona puede instalarla en `~/.claude/skills/`
  para uso propio, o pedirle una licencia al autor.
- Memory MCP de Anthropic: guarda un grafo de entidades en un JSONL aparte. Acá la memoria es el repo
  mismo (fichas, contexto, línea de tiempo, bitácoras), versionado y compartido; un segundo almacén
  duplicaría la verdad.
