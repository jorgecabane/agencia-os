from pathlib import Path

from aos.fm import leer

DOMINIOS_GENERICOS = frozenset({
    "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
    "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
})


def cargar_clientes(raiz: Path) -> list[dict]:
    return [leer(p)[0] for p in sorted((raiz / "clientes").glob("*/_ficha.md"))]


def _calza(email: str, dominio: str, cliente: dict) -> bool:
    if email in {e.lower() for e in cliente.get("emails") or []}:
        return True
    dominios = {d.lower() for d in cliente.get("dominios_email") or []}
    return dominio in dominios and dominio not in DOMINIOS_GENERICOS


def candidatos(emails: list[str], clientes: list[dict], internos: set[str] = frozenset()) -> set[str]:
    internos = {d.lower() for d in internos}
    externos = [e.lower() for e in emails if e.rpartition("@")[2].lower() not in internos]
    return {c["slug"] for c in clientes for e in externos if _calza(e, e.rpartition("@")[2], c)}


def cliente_para(emails: list[str], clientes: list[dict], internos: set[str] = frozenset()) -> str | None:
    slugs = candidatos(emails, clientes, internos)
    return slugs.pop() if len(slugs) == 1 else None
