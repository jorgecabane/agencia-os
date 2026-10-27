import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aos.esquemas import validar  # noqa: E402
from aos.fm import leer  # noqa: E402

DIRS = ("clientes", "equipo", "sesiones", "bandeja", "marca")


def _personas() -> set[str]:
    """Slugs de equipo/personas + ia; vacío si aún no hay equipo (no se valida responsable)."""
    slugs = set()
    for p in Path("equipo/personas").glob("*.md"):
        try:
            slugs.add(leer(p)[0].get("slug"))
        except Exception:
            pass
    return slugs | {"ia"} if slugs else set()


def _responsables(meta: dict) -> list:
    if meta.get("tipo") in ("entregable", "cliente"):
        return [meta.get("responsable")]
    if meta.get("tipo") == "plan" and isinstance(meta.get("recurrentes"), list):
        return [r.get("responsable") for r in meta["recurrentes"] if isinstance(r, dict)]
    return []


def main(args: list[str]) -> int:
    rutas = [Path(a) for a in args] or [
        p for d in DIRS for p in sorted(Path(d).rglob("*.md"))
    ]
    hubo, personas = False, _personas()
    for ruta in rutas:
        try:
            meta, _ = leer(ruta)
        except Exception as e:  # YAML roto o archivo ilegible
            meta, errs = None, [f"no se pudo leer: {e}"]
        else:
            errs = validar(meta) if isinstance(meta, dict) else ["frontmatter inválido"]
            if personas and isinstance(meta, dict):
                errs += [f"responsable '{r}' no está en equipo/personas (ni es ia)"
                         for r in _responsables(meta) if r is not None and r not in personas]
        for e in errs:
            print(f"{ruta}: {e}")
            hubo = True
    return 1 if hubo else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
