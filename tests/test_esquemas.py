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
