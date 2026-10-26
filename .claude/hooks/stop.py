#!/usr/bin/env python3
"""Hook Stop: exige bitácora de sesión y frontmatter válido. Nunca falla (exit 0)."""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from aos.esquemas import validar  # noqa: E402
from aos.fm import leer  # noqa: E402

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
    errores = [e for p in cambiados for e in _errores(raiz, p)]
    if errores:
        return "Corrige el frontmatter inválido:\n" + "\n".join(errores)
    en_clientes = any(p.relative_to(raiz).parts[0] == "clientes" for p in cambiados)
    if en_clientes and not _hay_bitacora(raiz, session_id):
        return MOTIVO_BITACORA.format(id=session_id)
    return None


def cambiados(raiz: Path) -> list[Path]:
    salida = subprocess.run(["git", "status", "--porcelain", "-z", "-uall"], cwd=raiz,
                            capture_output=True, text=True, check=True).stdout
    rutas, entradas = [], iter(salida.split("\0"))
    for e in entradas:
        if len(e) < 4:
            continue
        rutas.append(e[3:])
        if e[0] in "RC":
            next(entradas, None)  # el origen del renombre
    return [raiz / r for r in rutas
            if r.endswith(".md") and r.split("/")[0] in CARPETAS and (raiz / r).is_file()]


def main() -> None:
    datos = json.load(sys.stdin)
    raiz = Path(datos.get("cwd") or ".").resolve()
    motivo = revisar(raiz, datos.get("session_id", ""), cambiados(raiz),
                     bool(datos.get("stop_hook_active")))
    if motivo:
        print(json.dumps({"decision": "block", "reason": motivo}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
