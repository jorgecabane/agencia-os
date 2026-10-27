import re
from pathlib import Path

import yaml

_FM = re.compile(r"\A---\n(.*?)^---\n?", re.S | re.M)


def leer(path: Path) -> tuple[dict, str]:
    texto = path.read_text(encoding="utf-8")
    m = _FM.match(texto)
    if not m:
        return {}, texto
    return yaml.safe_load(m.group(1)) or {}, texto[m.end():]


def escribir(path: Path, meta: dict, cuerpo: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fm = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False)
    path.write_text(f"---\n{fm}---\n{cuerpo}", encoding="utf-8")
