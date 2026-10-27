from datetime import date

from aos.fm import escribir, leer


def test_roundtrip_preserva_wikilink_y_fecha(tmp_path):
    p = tmp_path / "a" / "x.md"
    escribir(p, {"tipo": "entregable", "vence": date(2026, 10, 30), "origen": "[[reu-1]]"}, "## Brief\nhola\n")
    meta, cuerpo = leer(p)
    assert meta["vence"] == date(2026, 10, 30)
    assert meta["origen"] == "[[reu-1]]"
    assert cuerpo == "## Brief\nhola\n"


def test_leer_sin_frontmatter(tmp_path):
    p = tmp_path / "c.md"
    p.write_text("# Contexto\n")
    assert leer(p) == ({}, "# Contexto\n")
