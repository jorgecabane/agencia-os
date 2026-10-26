from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from .esquemas import DIAS
from .fm import escribir, leer
from .slug import slug


@dataclass
class Cambios:
    creados: list[Path]
    eliminados: list[Path]


def _slots(reglas: list[dict], hoy: date, semanas: int) -> dict[tuple, dict]:
    slots = {}
    for i in range(7 * semanas):
        dia = hoy + timedelta(days=i)
        for r in reglas:
            cada = [r["cada"]] if isinstance(r["cada"], str) else r["cada"]
            if DIAS[dia.weekday()] in cada:
                slots[(r["nombre"], dia)] = r
    return slots


def _ruta_libre(carpeta: Path, fecha: date, nombre: str) -> Path:
    base = f"{fecha}-{slug(nombre)}"
    p, n = carpeta / f"{base}.md", 2
    while p.exists():
        p, n = carpeta / f"{base}-{n}.md", n + 1
    return p


def materializar(carpeta_cliente: Path, hoy: date, semanas: int = 4) -> Cambios:
    plan, _ = leer(carpeta_cliente / "plan-contratado.md")
    slots = _slots(plan.get("recurrentes") or [], hoy, semanas)
    carpeta = carpeta_cliente / "entregables"
    fin = hoy + timedelta(days=7 * semanas)
    existentes = {}  # (recurrente_de, recurrencia_fecha) -> (ruta, meta); nunca por `vence`
    for p in sorted(carpeta.glob("*.md")):
        meta, _ = leer(p)
        if meta.get("recurrente_de") and meta.get("recurrencia_fecha"):
            existentes[(meta["recurrente_de"], meta["recurrencia_fecha"])] = (p, meta)

    cambios = Cambios([], [])
    for (nombre, fecha), r in slots.items():
        if (nombre, fecha) in existentes:
            continue
        meta = {"tipo": "entregable", "cliente": carpeta_cliente.name, "formato": r["formato"],
                "vence": fecha, "estado": "brief", "responsable": r["responsable"],
                "recurrente_de": nombre, "recurrencia_fecha": fecha, "origen": "[[plan-contratado]]"}
        if r.get("skill"):
            meta["skill"] = r["skill"]
        p = _ruta_libre(carpeta, fecha, nombre)
        escribir(p, meta, "## Brief\n\n## Versiones\n")
        cambios.creados.append(p)
    for clave, (p, meta) in existentes.items():
        if hoy <= clave[1] < fin and clave not in slots and meta.get("estado") == "brief":
            p.unlink()
            cambios.eliminados.append(p)
    return cambios
