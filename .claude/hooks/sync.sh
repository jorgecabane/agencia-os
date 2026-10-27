#!/usr/bin/env bash
# Commit + sync con el equipo. Lo llama stop.py tras cada respuesta y SessionEnd como red final.
# Sale 0, salvo conflicto real (3): el commit queda local y stop.py le pide a Claude mezclarlo.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git remote get-url origin >/dev/null 2>&1 || exit 0
[ -d "$(git rev-parse --git-dir)/rebase-merge" ] && exit 0  # Claude está resolviendo un conflicto

persona="${AOS_PERSONA:-$(git config user.name)}"
persona="${persona:-sin-nombre}"

[ -z "$(git status --porcelain)" ] && [ -z "$(git rev-list @{u}.. 2>/dev/null)" ] && exit 0
if [ -n "$(git status --porcelain)" ]; then
  git add -A && git commit -qm "sesión: $persona $(date -u +%FT%RZ)"
fi

if ! git pull -q --rebase --autostash; then
  conflicto="$(git diff --name-only --diff-filter=U)"
  git rebase --abort 2>/dev/null
  if [ -n "$conflicto" ]; then
    echo "agencia-os: conflicto con cambios del equipo en: $conflicto" >&2
    exit 3
  fi
  echo "agencia-os: no se pudo sincronizar (sin red); tu commit quedó local y se reintenta en la próxima respuesta" >&2
  exit 0
fi
git push -q || echo "agencia-os: no pude subir los cambios; se reintenta en la próxima respuesta" >&2
exit 0
