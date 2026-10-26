import shutil
import subprocess
import sys
from pathlib import Path

from aos.clientes import candidatos, cargar_clientes, cliente_para
from aos.esquemas import validar

FIX = Path(__file__).parent / "fixtures" / "repo"
CLI = Path(__file__).parents[1] / "scripts" / "cliente.py"
C = cargar_clientes(FIX)


def cli(cwd, *args):
    r = subprocess.run([sys.executable, str(CLI), *args], cwd=cwd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def test_fichas_validas():
    assert len(C) == 2 and all(validar(c) == [] for c in C)


def test_por_dominio(): assert cliente_para(["Ana@ACME.cl"], C) == "acme"
def test_generico_no_calza_por_dominio(): assert cliente_para(["otro@gmail.com"], C) is None
def test_generico_calza_por_email_exacto(): assert cliente_para(["dueño.acme@gmail.com"], C) == "acme"
def test_internos_se_ignoran(): assert cliente_para(["jorge@agencia.cl", "x@acme.cl"], C, {"agencia.cl"}) == "acme"
def test_ambiguo(): assert cliente_para(["a@acme.cl", "b@beta.com"], C) is None
def test_candidatos_ambiguo(): assert candidatos(["a@acme.cl", "b@beta.com"], C) == {"acme", "beta"}
def test_candidatos_nadie(): assert candidatos(["x@gmail.com"], C) == set()
def test_nadie(): assert cliente_para(["jorge@agencia.cl"], C, {"agencia.cl"}) is None


def test_cli_ignora_dominio_de_marca(tmp_path):
    repo = tmp_path / "repo"
    shutil.copytree(FIX, repo)
    (repo / "marca").mkdir()
    (repo / "marca" / "marca.md").write_text("---\ndominio_email: acme.cl\n---\n", encoding="utf-8")
    assert cli(repo, "x@acme.cl", "y@beta.com") == "beta"
    assert cli(FIX, "x@acme.cl") == "acme"
    assert cli(FIX, "x@zzz.cl") == "ninguno"
    assert cli(FIX, "j@beta.com", "x@acme.cl", "--interno", "beta.com") == "acme"


def test_cli_ambiguo(tmp_path):
    assert cli(FIX, "a@acme.cl", "b@beta.com") == "ambiguo: acme, beta"
    repo = tmp_path / "repo"
    shutil.copytree(FIX, repo)
    ficha = repo / "clientes" / "beta" / "_ficha.md"
    ficha.write_text(ficha.read_text(encoding="utf-8").replace("[beta.com]", "[beta.com, acme.cl]"), encoding="utf-8")
    assert cli(repo, "ana@acme.cl") == "ambiguo: acme, beta"  # un solo email, dos fichas
