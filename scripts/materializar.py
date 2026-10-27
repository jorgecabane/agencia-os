import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aos.recurrentes import materializar  # noqa: E402


def main(args: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Crea los entregables recurrentes de las próximas 4 semanas.")
    ap.add_argument("--hoy", type=date.fromisoformat, default=date.today())
    ap.add_argument("--detalle", action="store_true", help="lista cada archivo creado (+) y eliminado (-)")
    a = ap.parse_args(args)
    for plan in sorted(Path("clientes").glob("*/plan-contratado.md")):
        c = materializar(plan.parent, a.hoy)
        print(f"{plan.parent.name}: +{len(c.creados)} -{len(c.eliminados)}")
        if a.detalle:
            for signo, rutas in (("+", c.creados), ("-", c.eliminados)):
                for r in sorted(rutas):
                    print(f"  {signo} {r.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
