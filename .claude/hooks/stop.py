#!/usr/bin/env python3
"""Hook Stop: exige bitácora de sesión y frontmatter válido. Nunca falla (exit 0)."""
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

try:
    from aos.esquemas import validar
    from aos.fm import leer
except ImportError:  # sin deps el hook no debe romper la sesión; main() lo atrapa
    pass

CARPETAS = ("clientes", "equipo", "sesiones", "bandeja", "marca")
MOTIVO_BITACORA = (
    "Antes de terminar, escribe la bitácora de esta sesión en "
    "sesiones/YYYY-MM-DD-<persona>-<slug>.md (tipo: sesion, persona, fecha, "
    "session_id: {id}, clientes: [...]) con: qué se hizo, skill usada, "
    "correcciones del usuario, pendientes."
)


def _errores(raiz: Path, ruta: Path) -> list[str]:
    rel = ruta.relative_to(raiz).as_posix()
    try:
        meta, _ = leer(ruta)
    except FileNotFoundError:
        return []  # borrado: nada que validar
    except Exception:
        return [f"{rel}: frontmatter inválido"]
    if not isinstance(meta, dict):
        return [f"{rel}: frontmatter inválido"]
    return [f"{rel}: {e}" for e in validar(meta)]


def _hay_bitacora(raiz: Path, session_id: str) -> bool:
    for p in (raiz / "sesiones").glob("*.md"):
        try:
            meta, _ = leer(p)
        except Exception:
            continue
        if isinstance(meta, dict) and meta.get("session_id") == session_id:
            return True
    return False


def revisar(raiz: Path, session_id: str, cambiados: list[Path], ya_bloqueado: bool) -> str | None:
    if ya_bloqueado:
        return None
    partes = []
    errores = [e for p in cambiados for e in _errores(raiz, p)]
    if errores:
        partes.append("Corrige el frontmatter inválido:\n" + "\n".join(errores))
    en_clientes = any(p.relative_to(raiz).parts[0] == "clientes" for p in cambiados)
    if en_clientes and not _hay_bitacora(raiz, session_id):
        partes.append(MOTIVO_BITACORA.format(id=session_id))
    return "\n\n".join(partes) or None


def _git(raiz: Path, *a: str) -> str:
    return subprocess.run(["git", *a], cwd=raiz, capture_output=True, text=True,
                          check=True).stdout


def _sucios(raiz: Path) -> list[str]:
    rutas, entradas = [], iter(_git(raiz, "status", "--porcelain", "-z", "-uall").split("\0"))
    for e in entradas:
        if len(e) < 4:
            continue
        rutas.append(e[3:])
        if e[0] in "RC":
            next(entradas, None)  # el origen del renombre
    return rutas


def _commiteados(raiz: Path, session_id: str) -> list[str]:
    """Lo commiteado desde el inicio de la sesión (Obsidian Git auto-commitea cada 5 min)."""
    archivo = Path(_git(raiz, "rev-parse", "--absolute-git-dir").strip()) / f"aos-sesion-{session_id}"
    try:
        base = archivo.read_text().strip()
        _git(raiz, "merge-base", "--is-ancestor", base, "HEAD")
    except (OSError, subprocess.CalledProcessError):
        return []  # sin base o inalcanzable: solo lo sucio
    return _git(raiz, "diff", "--name-only", "-z", f"{base}..HEAD").split("\0")


def cambiados(raiz: Path, session_id: str = "") -> list[Path]:
    rutas = dict.fromkeys(_sucios(raiz) + (_commiteados(raiz, session_id) if session_id else []))
    return [raiz / r for r in rutas
            if r.endswith(".md") and r.split("/")[0] in CARPETAS and (raiz / r).is_file()]


def main() -> None:
    datos = json.load(sys.stdin)
    cwd = datos.get("cwd") or "."
    raiz = os.environ.get("CLAUDE_PROJECT_DIR") or subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True,
        check=True).stdout.strip()
    raiz = Path(raiz).resolve()
    motivo = revisar(raiz, datos.get("session_id", ""), cambiados(raiz, datos.get("session_id", "")),
                     bool(datos.get("stop_hook_active")))
    if motivo:
        print(json.dumps({"decision": "block", "reason": motivo}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
