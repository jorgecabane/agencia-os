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


def test_errores_y_bitacora_en_un_solo_motivo(repo):
    p = repo / "clientes/acme/entregables/e.md"
    escribir(p, {"tipo": "entregable", "cliente": "acme"}, "")
    motivo = revisar(repo, "s1", [p], False)
    assert "falta '" in motivo and "bitácora" in motivo


def test_cwd_subdirectorio(tmp_path, monkeypatch):
    _git(tmp_path, "init", "-q")
    (tmp_path / "clientes/acme").mkdir(parents=True)
    (tmp_path / "clientes/acme/x.md").write_text("hola")
    monkeypatch.delenv("CLAUDE_PROJECT_DIR", raising=False)
    entrada = json.dumps({"session_id": "s", "cwd": str(tmp_path / "clientes/acme")})
    r = subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True)
    assert r.returncode == 0 and "bitácora" in json.loads(r.stdout)["reason"]


def _commit(cwd, msg="x", autor="a@b"):
    _git(cwd, "config", "user.email", "a@b")
    _git(cwd, "add", "-A")
    _git(cwd, "-c", f"user.email={autor}", "-c", "user.name=a", "commit", "-q", "--allow-empty",
         "-m", msg)


def _inicio(cwd, sid):
    entrada = json.dumps({"session_id": sid, "cwd": str(cwd)})
    subprocess.run([sys.executable, str(HOOK.parent / "session_start.py")], input=entrada,
                   capture_output=True, text=True, check=True)


def _stop(cwd, sid):
    entrada = json.dumps({"session_id": sid, "cwd": str(cwd), "stop_hook_active": False})
    r = subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True,
                       env={k: v for k, v in __import__("os").environ.items()
                            if k != "CLAUDE_PROJECT_DIR"})
    assert r.returncode == 0
    return json.loads(r.stdout)["reason"] if r.stdout else None


def test_cambio_ya_commiteado_igual_bloquea(tmp_path):
    _git(tmp_path, "init", "-q")
    _commit(tmp_path, "inicial")
    _inicio(tmp_path, "s1")
    (tmp_path / "clientes/acme").mkdir(parents=True)
    (tmp_path / "clientes/acme/x.md").write_text("hola")
    _commit(tmp_path, "auto-commit de Obsidian Git")
    assert "bitácora" in _stop(tmp_path, "s1")


def test_entregable_invalido_commiteado_bloquea(tmp_path):
    _git(tmp_path, "init", "-q")
    _commit(tmp_path, "inicial")
    _inicio(tmp_path, "s1")
    escribir(tmp_path / "clientes/acme/entregables/e.md", {"tipo": "entregable", "cliente": "acme"}, "")
    _commit(tmp_path)
    assert "falta 'formato'" in _stop(tmp_path, "s1")


def test_commit_previo_a_la_sesion_no_cuenta(tmp_path):
    _git(tmp_path, "init", "-q")
    (tmp_path / "clientes/acme").mkdir(parents=True)
    (tmp_path / "clientes/acme/x.md").write_text("hola")
    _commit(tmp_path)
    _inicio(tmp_path, "s1")
    assert _stop(tmp_path, "s1") is None


def test_base_inalcanzable_usa_solo_sucios(tmp_path):
    _git(tmp_path, "init", "-q")
    _commit(tmp_path)
    (tmp_path / ".git/aos-sesion-s1").write_text("0" * 40)
    (tmp_path / "clientes/acme").mkdir(parents=True)
    (tmp_path / "clientes/acme/x.md").write_text("hola")
    _commit(tmp_path)
    assert _stop(tmp_path, "s1") is None


def test_commit_de_un_companero_no_cuenta(tmp_path):
    _git(tmp_path, "init", "-q")
    _commit(tmp_path, "inicial")
    _inicio(tmp_path, "s1")
    (tmp_path / "clientes/acme").mkdir(parents=True)
    (tmp_path / "clientes/acme/x.md").write_text("hola")
    _commit(tmp_path, "traído con pull", autor="otro@b")
    assert _stop(tmp_path, "s1") is None


def test_conflicto_pide_mezclar(tmp_path, monkeypatch):
    monkeypatch.setattr(stop.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        a, 3, "", "agencia-os: conflicto con cambios del equipo en: clientes/acme/contexto.md"))
    motivo = stop._sincronizar(tmp_path, False)
    assert "clientes/acme/contexto.md" in motivo and "rebase --continue" in motivo
    assert stop._sincronizar(tmp_path, True) is None
