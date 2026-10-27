import subprocess
import sys
from datetime import date
from pathlib import Path

from aos.esquemas import validar

VALIDAR = Path(__file__).resolve().parent.parent / "scripts" / "validar.py"


def test_entregable_valido():
    assert validar({"tipo": "entregable", "cliente": "acme", "formato": "post-instagram",
                    "vence": date(2026, 10, 30), "estado": "brief", "responsable": "ia"}) == []


def test_fecha_como_string_iso_es_valida():
    assert validar({"tipo": "decision", "cliente": "acme", "fecha": "2026-10-22"}) == []


def test_errores_legibles():
    errs = validar({"tipo": "entregable", "cliente": "acme", "formato": "x",
                    "vence": "mañana", "estado": "listo"})
    assert "falta 'responsable'" in errs
    assert "'estado' debe ser uno de: aprobado, brief, cancelado, en_curso, publicado, revision" in errs
    assert "'vence' no es fecha (YYYY-MM-DD)" in errs


def test_sin_tipo_ok():
    assert validar({}) == []


def test_tipo_desconocido():
    assert validar({"tipo": "cosa"}) == ["tipo desconocido 'cosa'"]


def test_plan_recurrente_dia_invalido():
    errs = validar({"tipo": "plan", "cliente": "acme", "recurrentes": [
        {"nombre": "Post", "formato": "post-instagram", "cada": ["martes"], "responsable": "ia"}]})
    assert errs == ["recurrentes[0].cada: 'martes' no es día (lun mar mie jue vie sab dom)"]


def test_plan_recurrente_valido_y_faltante():
    ok = {"nombre": "Post", "formato": "f", "cada": "lun", "responsable": "ia"}
    assert validar({"tipo": "plan", "cliente": "a", "recurrentes": [ok]}) == []
    errs = validar({"tipo": "plan", "cliente": "a", "recurrentes": [{"nombre": "x"}]})
    assert "recurrentes[0]: falta 'cada'" in errs


def test_persona_nivel_invalido():
    errs = validar({"tipo": "persona", "nombre": "n", "slug": "n", "rol": "r",
                    "nivel_automatizacion": "x"})
    assert errs == ["'nivel_automatizacion' debe ser uno de: alto, bajo, medio"]


def _cli(cwd, *args):
    return subprocess.run([sys.executable, str(VALIDAR), *args], cwd=cwd,
                          capture_output=True, text=True)


def test_cli_sale_1_con_errores(tmp_path):
    f = tmp_path / "x.md"
    f.write_text("---\ntipo: decision\ncliente: acme\n---\nhola\n")
    r = _cli(tmp_path, str(f))
    assert r.returncode == 1 and "falta 'fecha'" in r.stdout


def test_cli_sin_rutas_recorre_dirs_y_sale_0(tmp_path):
    (tmp_path / "clientes").mkdir()
    (tmp_path / "clientes" / "a.md").write_text("---\ntipo: decision\ncliente: a\nfecha: 2026-10-22\n---\n")
    assert _cli(tmp_path).returncode == 0


def test_fecha_datetime_string_valida():
    assert validar({"tipo": "decision", "cliente": "a", "fecha": "2026-10-22T10:00:00"}) == []


def test_plan_cada_tipo_invalido_y_recurrentes_no_lista():
    r = {"nombre": "x", "formato": "f", "cada": 5, "responsable": "ia"}
    assert validar({"tipo": "plan", "cliente": "a", "recurrentes": [r]}) == [
        "recurrentes[0].cada debe ser texto o lista"]
    assert validar({"tipo": "plan", "cliente": "a", "recurrentes": "x"}) == [
        "'recurrentes' debe ser lista"]


def test_cliente_dominios_y_emails_deben_ser_lista():
    base = {"tipo": "cliente", "nombre": "A", "slug": "a", "etapa": "activo",
            "modalidad": "retainer", "responsable": "jorge"}
    assert validar({**base, "dominios_email": ["a.cl"], "emails": ["x@y.cl"]}) == []
    assert validar({**base, "dominios_email": "a.cl", "emails": "x@y.cl"}) == [
        "'dominios_email' debe ser lista", "'emails' debe ser lista"]


def test_cli_incluye_marca(tmp_path):
    (tmp_path / "marca").mkdir()
    (tmp_path / "marca" / "m.md").write_text("---\ntipo: decision\n---\n")
    r = _cli(tmp_path)
    assert r.returncode == 1 and "marca/m.md: falta 'cliente'" in r.stdout


def test_cli_frontmatter_no_dict_sigue_con_los_demas(tmp_path):
    (tmp_path / "clientes").mkdir()
    (tmp_path / "clientes" / "a.md").write_text("---\n- a\n- b\n---\n")
    (tmp_path / "clientes" / "b.md").write_text("---\ntipo: decision\ncliente: a\n---\n")
    r = _cli(tmp_path)
    assert r.returncode == 1 and "Traceback" not in r.stderr
    assert "clientes/a.md: frontmatter inválido" in r.stdout
    assert "clientes/b.md: falta 'fecha'" in r.stdout


def test_persona_zona_horaria():
    base = {"tipo": "persona", "nombre": "n", "slug": "n", "rol": "r", "nivel_automatizacion": "alto"}
    assert validar({**base, "zona_horaria": "America/Santiago"}) == []
    assert "zona IANA" in validar({**base, "zona_horaria": "Chile"})[0]


def test_cli_responsable_debe_ser_del_equipo(tmp_path):
    (tmp_path / "equipo/personas").mkdir(parents=True)
    (tmp_path / "equipo/personas/cami.md").write_text(
        "---\ntipo: persona\nnombre: Cami\nslug: cami\nrol: marketing\nnivel_automatizacion: alto\n---\n")
    e = tmp_path / "clientes/acme/entregables"
    e.mkdir(parents=True)
    base = "---\ntipo: entregable\ncliente: acme\nformato: post\nvence: 2026-10-30\nestado: brief\n"
    (e / "a.md").write_text(base + "responsable: cami\n---\n")
    (e / "b.md").write_text(base + "responsable: ia\n---\n")
    assert _cli(tmp_path).returncode == 0
    (e / "c.md").write_text(base + "responsable: kami\n---\n")
    r = _cli(tmp_path)
    assert r.returncode == 1 and "responsable 'kami'" in r.stdout
