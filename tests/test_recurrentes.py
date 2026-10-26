import subprocess
import sys
from datetime import date
from pathlib import Path

from aos.esquemas import validar
from aos.fm import escribir, leer
from aos.recurrentes import Cambios, materializar

HOY = date(2026, 10, 26)  # lunes
MAT = Path(__file__).parents[1] / "scripts" / "materializar.py"


def plan(cli, cada=("mar", "jue")):
    regla = {"nombre": "Post feed", "formato": "post", "cada": list(cada), "responsable": "marketing"}
    escribir(cli / "plan-contratado.md", {"tipo": "plan", "cliente": "acme", "recurrentes": [regla]}, "")


def mk(tmp_path):
    cli = tmp_path / "clientes" / "acme"
    plan(cli)
    return cli


def marcar_estado(p, estado):
    m, b = leer(p)
    m["estado"] = estado
    escribir(p, m, b)


def test_crea_slots_de_4_semanas(tmp_path):
    cli = mk(tmp_path)
    c = materializar(cli, HOY)
    assert len(c.creados) == 8
    meta, _ = leer(cli / "entregables/2026-10-27-post-feed.md")
    assert meta["estado"] == "brief" and meta["recurrencia_fecha"] == date(2026, 10, 27)
    assert meta["cliente"] == "acme" and meta["recurrente_de"] == "Post feed"
    assert all(validar(leer(p)[0]) == [] for p in c.creados)


def test_cada_como_texto_y_skill(tmp_path):
    cli = tmp_path / "clientes" / "acme"
    escribir(cli / "plan-contratado.md", {"tipo": "plan", "cliente": "acme", "recurrentes": [
        {"nombre": "Reel", "formato": "reel", "cada": "lun", "responsable": "ia", "skill": "guion"}]}, "")
    c = materializar(cli, HOY)
    assert len(c.creados) == 4
    meta, _ = leer(c.creados[0])
    assert meta["skill"] == "guion" and validar(meta) == []


def test_idempotente(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    assert materializar(cli, HOY) == Cambios([], [])


def test_movido_no_se_duplica(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    p = cli / "entregables/2026-10-27-post-feed.md"
    m, b = leer(p)
    m["vence"] = date(2026, 10, 30)
    escribir(p, m, b)
    assert materializar(cli, HOY).creados == []


def test_cambio_de_regla_respeta_en_curso(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    marcar_estado(cli / "entregables/2026-10-29-post-feed.md", "en_curso")
    plan(cli, cada=["mar"])
    c = materializar(cli, HOY)
    assert len(c.eliminados) == 3  # jueves 5/11, 12/11, 19/11
    assert (cli / "entregables/2026-10-29-post-feed.md").exists()


def test_fuera_de_ventana_no_se_toca(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    plan(cli, cada=["mar"])
    c = materializar(cli, date(2026, 11, 2))  # 27/10 y 29/10 quedan atrás
    assert (cli / "entregables/2026-10-29-post-feed.md").exists()
    assert (cli / "entregables/2026-10-27-post-feed.md").exists()
    assert (cli / "entregables/2026-10-29-post-feed.md").exists()
    assert not (cli / "entregables/2026-11-05-post-feed.md").exists()
    assert len(c.eliminados) == 3


def test_colision_de_nombre(tmp_path):
    cli = mk(tmp_path)
    escribir(cli / "entregables/2026-10-27-post-feed.md",
             {"tipo": "entregable", "cliente": "acme", "formato": "post", "vence": date(2026, 10, 27),
              "estado": "brief", "responsable": "marketing"}, "")
    materializar(cli, HOY)
    assert (cli / "entregables/2026-10-27-post-feed-2.md").exists()
    assert materializar(cli, HOY) == Cambios([], [])


def test_cli(tmp_path):
    cli = mk(tmp_path)
    r = subprocess.run([sys.executable, str(MAT), "--hoy", "2026-10-26"], cwd=tmp_path,
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip() == "acme: +8 -0"


def test_cli_detalle(tmp_path):
    mk(tmp_path)
    r = subprocess.run([sys.executable, str(MAT), "--hoy", "2026-10-26", "--detalle"], cwd=tmp_path,
                       capture_output=True, text=True)
    lineas = r.stdout.splitlines()
    assert lineas[0] == "acme: +8 -0"
    assert lineas[1] == "  + clientes/acme/entregables/2026-10-27-post-feed.md" and len(lineas) == 9


def test_brief_con_contenido_no_se_borra(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    p = cli / "entregables/2026-11-05-post-feed.md"
    m, _ = leer(p)
    escribir(p, m, "## Brief\n\nIdea: promo de primavera\n\n## Versiones\n")
    plan(cli, cada=["mar"])
    c = materializar(cli, HOY)
    assert p.exists() and len(c.eliminados) == 3


def test_recurrencia_fecha_como_texto(tmp_path):
    cli = mk(tmp_path)
    materializar(cli, HOY)
    p = cli / "entregables/2026-10-27-post-feed.md"
    m, b = leer(p)
    m["recurrencia_fecha"] = "2026-10-27"
    escribir(p, m, b)
    assert materializar(cli, HOY) == Cambios([], [])
