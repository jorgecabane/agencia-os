import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aos.esquemas import validar  # noqa: E402
from aos.fm import leer  # noqa: E402

DIRS = ("clientes", "equipo", "sesiones", "bandeja", "marca")


def main(args: list[str]) -> int:
    rutas = [Path(a) for a in args] or [
        p for d in DIRS for p in sorted(Path(d).rglob("*.md"))
    ]
    hubo = False
    for ruta in rutas:
        try:
            meta, _ = leer(ruta)
        except Exception as e:  # YAML roto o archivo ilegible
            meta, errs = None, [f"no se pudo leer: {e}"]
        else:
            errs = validar(meta) if isinstance(meta, dict) else ["frontmatter inválido"]
        for e in errs:
            print(f"{ruta}: {e}")
            hubo = True
    return 1 if hubo else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
