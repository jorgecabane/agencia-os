from aos.slug import slug


def test_slug_tildes_y_apostrofes():
    assert slug("Donna's") == "donnas"
    assert slug("Clima Simple") == "clima-simple"
    assert slug("Campaña Año Nuevo") == "campana-ano-nuevo"
    assert slug("  Post  feed / IG ") == "post-feed-ig"
