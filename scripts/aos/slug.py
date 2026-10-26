import re
import unicodedata


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFKD", texto)
    base = "".join(c for c in base if not unicodedata.combining(c))
    base = re.sub(r"['’`]", "", base.lower())
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-")
