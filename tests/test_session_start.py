import json
import subprocess
import sys
from pathlib import Path

HOOK = Path(__file__).parent.parent / ".claude/hooks/session_start.py"


def test_imprime_session_id():
    r = subprocess.run([sys.executable, str(HOOK)], input=json.dumps({"session_id": "abc-123"}),
                       capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout.strip() == "session_id: abc-123"


def _git(cwd, *a):
    return subprocess.run(["git", "-C", str(cwd), *a], check=True, capture_output=True,
                          text=True).stdout.strip()


def test_guarda_head_base_sin_pisar(tmp_path):
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q",
         "--allow-empty", "-m", "x")
    head = _git(tmp_path, "rev-parse", "HEAD")
    entrada = json.dumps({"session_id": "s1", "cwd": str(tmp_path)})
    r = subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True)
    assert r.returncode == 0
    base = tmp_path / ".git/aos-sesion-s1"
    assert base.read_text().strip() == head
    base.write_text("otro")  # reanudar la sesión no pisa la base
    subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True)
    assert base.read_text() == "otro"


def test_sin_git_no_falla(tmp_path):
    entrada = json.dumps({"session_id": "s1", "cwd": str(tmp_path)})
    r = subprocess.run([sys.executable, str(HOOK)], input=entrada, capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout.strip() == "session_id: s1"
