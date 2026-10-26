import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aos.clientes import candidatos, cargar_clientes  # noqa: E402
from aos.fm import leer  # noqa: E402


def main(args: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Imprime el slug del cliente, 'ninguno' o 'ambiguo: <slugs>'.")
    ap.add_argument("emails", nargs="+")
    ap.add_argument("--interno", action="append", default=[], metavar="DOMINIO")
    a = ap.parse_args(args)
    internos = set(a.interno)
    marca = Path("marca/marca.md")
    if marca.exists() and (d := leer(marca)[0].get("dominio_email")):
        internos.add(d)
    slugs = sorted(candidatos(a.emails, cargar_clientes(Path.cwd()), internos))
    if len(slugs) > 1:
        print("ambiguo: " + ", ".join(slugs))
    else:
        print(slugs[0] if slugs else "ninguno")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
