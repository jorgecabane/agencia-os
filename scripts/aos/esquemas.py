from datetime import date

DIAS = ("lun", "mar", "mie", "jue", "vie", "sab", "dom")
_ETAPAS = {"prospecto", "propuesta", "activo", "pausado", "cerrado"}
_MODALIDADES = {"retainer", "proyecto", "mixto"}
_ESTADOS = {"brief", "en_curso", "revision", "aprobado", "publicado", "cancelado"}
_RECURRENTE = ("nombre", "formato", "cada", "responsable")


def _esq(requeridos, enums=None, fechas=None):
    return {"requeridos": requeridos, "enums": enums or {}, "fechas": fechas or []}


ESQUEMAS: dict[str, dict] = {
    "cliente": _esq(["nombre", "slug", "etapa", "modalidad", "responsable"],
                    {"etapa": _ETAPAS, "modalidad": _MODALIDADES}, ["proximo_contacto"]),
    "plan": _esq(["cliente"], fechas=["vigente_desde"]),
    "entregable": _esq(["cliente", "formato", "vence", "estado", "responsable"],
                       {"estado": _ESTADOS}, ["vence", "recurrencia_fecha"]),
    "reunion": _esq(["cliente", "fecha"], fechas=["fecha"]),
    "brief-reunion": _esq(["cliente", "fecha"], fechas=["fecha"]),
    "decision": _esq(["cliente", "fecha"], fechas=["fecha"]),
    "sesion": _esq(["persona", "fecha", "session_id", "clientes"], fechas=["fecha"]),
    "persona": _esq(["nombre", "slug", "rol", "nivel_automatizacion"],
                    {"nivel_automatizacion": {"alto", "medio", "bajo"}}),
}


def _es_fecha(v) -> bool:
    if isinstance(v, date):  # incluye datetime
        return True
    try:
        date.fromisoformat(v)
        return True
    except (TypeError, ValueError):
        return False


def _errores_recurrente(i: int, r) -> list[str]:
    if not isinstance(r, dict):
        return [f"recurrentes[{i}]: debe ser un mapa"]
    errs = [f"recurrentes[{i}]: falta '{c}'" for c in _RECURRENTE if r.get(c) is None]
    cada = r.get("cada")
    if cada is not None:
        for d in [cada] if isinstance(cada, str) else cada:
            if d not in DIAS:
                errs.append(f"recurrentes[{i}].cada: '{d}' no es día ({' '.join(DIAS)})")
    return errs


def validar(meta: dict) -> list[str]:
    tipo = meta.get("tipo")
    if tipo is None:
        return []
    esq = ESQUEMAS.get(tipo)
    if esq is None:
        return [f"tipo desconocido '{tipo}'"]
    errs = [f"falta '{c}'" for c in esq["requeridos"] if meta.get(c) is None]
    for campo, validos in esq["enums"].items():
        v = meta.get(campo)
        if v is not None and v not in validos:
            errs.append(f"'{campo}' debe ser uno de: {', '.join(sorted(validos))}")
    for campo in esq["fechas"]:
        v = meta.get(campo)
        if v is not None and not _es_fecha(v):
            errs.append(f"'{campo}' no es fecha (YYYY-MM-DD)")
    if tipo == "plan":
        for i, r in enumerate(meta.get("recurrentes") or []):
            errs += _errores_recurrente(i, r)
    return errs
