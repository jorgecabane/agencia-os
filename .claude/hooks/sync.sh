#!/usr/bin/env bash
# Hook SessionEnd: commit + sync con el equipo. Nunca falla (exit 0).
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git remote get-url origin >/dev/null 2>&1 || exit 0

persona="${AOS_PERSONA:-$(git config user.name)}"
persona="${persona:-sin-nombre}"

[ -z "$(git status --porcelain)" ] && [ -z "$(git rev-list @{u}.. 2>/dev/null)" ] && exit 0
if [ -n "$(git status --porcelain)" ]; then
  git add -A && git commit -qm "sesión: $persona $(date +%F)"
fi

if ! git pull -q --rebase --autostash; then
  git rebase --abort 2>/dev/null
  echo "agencia-os: no se pudo sincronizar (conflicto o red); tu commit quedó local, resuélvelo con Claude" >&2
  exit 0
fi
git push -q || echo "agencia-os: no pude subir los cambios; reintenta con git push" >&2
exit 0
