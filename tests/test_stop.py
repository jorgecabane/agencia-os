import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

from aos.fm import escribir

HOOK = Path(__file__).parent.parent / ".claude/hooks/stop.py"
spec = importlib.util.spec_from_file_location("stop", HOOK)
stop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stop)
revisar = stop.revisar


@pytest.fixture
def repo(tmp_path):
    return tmp_path


def test_bloquea_sin_bitacora(repo):
    assert "bitácora" in revisar(repo, "s1", [repo / "clientes/acme/decisiones/x.md"], False)


def test_no_bloquea_con_bitacora(repo):
    escribir(repo / "sesiones/2026-10-26-jorge-acme.md",
             {"tipo": "sesion", "persona": "jorge", "fecha": "2026-10-26",
              "session_id": "s1", "clientes": ["acme"]}, "")
    assert revisar(repo, "s1", [repo / "clientes/acme/decisiones/x.md"], False) is None


def test_no_loop(repo):
    assert revisar(repo, "s1", [repo / "clientes/acme/decisiones/x.md"], True) is None


def test_invalido_bloquea(repo):
    p = repo / "clientes/acme/entregables/e.md"
    escribir(p, {"tipo": "entregable", "cliente": "acme", "formato": "reel",
                 "vence": "2026-11-01", "estado": "brief"}, "")
    motivo = revisar(repo, "s1", [p], False)
    assert "falta 'responsable'" in motivo and "clientes/acme/entregables/e.md" in motivo


def test_frontmatter_no_dict_no_revienta(repo):
    p = repo / "clientes/acme/notas.md"
    p.parent.mkdir(parents=True)
    p.write_text("---\n- a\n- b\n---\ntexto\n")
    assert "clientes/acme/notas.md: frontmatter inválido" in revisar(repo, "s1", [p], False)


def test_archivo_ilegible_no_revienta(repo):
    p = repo / "clientes/acme/binario.md"
    p.parent.mkdir(parents=True)
    p.write_bytes(b"\xff\xfe")
    assert "frontmatter inválido" in revisar(repo, "s1", [p], False)


def test_sin_cambios_en_clientes(repo):
    assert revisar(repo, "s1", [], False) is None


def _git(cwd, *a):
    subprocess.run(["git", "-C", str(cwd), *a], check=True, capture_output=True)


def test_script_bloquea_y_nunca_falla(tmp_path):
    _git(tmp_path, "init", "-q")
    p = tmp_path / "clientes/ñandú/x.md"
    p.parent.mkdir(parents=True)
    p.write_text("hola")
    entrada = json.dumps({"session_id": "s9", "cwd": str(tmp_path), "stop_hook_active": False})
    r = subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True)
    assert r.returncode == 0
    assert json.loads(r.stdout)["decision"] == "block"
    r = subprocess.run([sys.executable, str(HOOK)], input="basura", capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout == ""
