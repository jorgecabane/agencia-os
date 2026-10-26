#!/usr/bin/env python3
"""Hook SessionStart: le dice a Claude su session_id para la bitácora y guarda el HEAD
de inicio en <git-dir>/aos-sesion-<id> (para que Stop vea lo ya commiteado). Nunca falla."""
import json
import subprocess
import sys
from pathlib import Path


def _git(cwd, *a) -> str:
    return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True,
                          check=True).stdout.strip()


try:
    datos = json.load(sys.stdin)
    sid = datos["session_id"]
    print(f"session_id: {sid}")
    cwd = datos.get("cwd") or "."
    base = Path(_git(cwd, "rev-parse", "--absolute-git-dir")) / f"aos-sesion-{sid}"
    if not base.exists():  # al reanudar/compactar se conserva la base original
        base.write_text(_git(cwd, "rev-parse", "HEAD") + "\n")
except Exception:
    pass
