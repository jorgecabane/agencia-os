import os
import subprocess
from pathlib import Path

SYNC = Path(__file__).parent.parent / ".claude/hooks/sync.sh"
ENV = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
       "GIT_COMMITTER_EMAIL": "t@t", "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null"}


def git(cwd, *a):
    return subprocess.run(["git", "-C", str(cwd), "-c", "commit.gpgsign=false", *a],
                          check=True, capture_output=True, text=True, env=ENV).stdout


def sync(cwd):
    return subprocess.run([str(SYNC)], capture_output=True, text=True,
                          env={**ENV, "CLAUDE_PROJECT_DIR": str(cwd), "AOS_PERSONA": "jorge"}, cwd=cwd)


def setup(tmp_path):
    remoto = tmp_path / "r.git"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(remoto)], check=True, env=ENV)
    a = tmp_path / "a"
    git(tmp_path, "clone", "-q", str(remoto), str(a))
    git(a, "checkout", "-q", "-b", "main")
    (a / "f.txt").write_text("1\n2\n3\n")
    (a / "g.txt").write_text("g\n")
    git(a, "add", "-A")
    git(a, "commit", "-qm", "init")
    git(a, "push", "-q", "-u", "origin", "main")
    b = tmp_path / "b"
    git(tmp_path, "clone", "-q", str(remoto), str(b))
    return remoto, a, b


def test_sube_cambios(tmp_path):
    remoto, a, _ = setup(tmp_path)
    (a / "f.txt").write_text("1\n2\n3\n4\n")
    assert sync(a).returncode == 0
    assert "sesión: jorge" in git(remoto, "log", "-1", "--format=%s")


def test_trae_cambios_ajenos(tmp_path):
    remoto, a, b = setup(tmp_path)
    (b / "g.txt").write_text("b\n")
    git(b, "commit", "-qam", "b")
    git(b, "push", "-q")
    (a / "f.txt").write_text("1\n2\n3\n4\n")
    assert sync(a).returncode == 0
    assert (a / "g.txt").read_text() == "b\n"
    assert git(remoto, "show", "main:f.txt") == "1\n2\n3\n4\n"
    assert git(remoto, "show", "main:g.txt") == "b\n"


def test_conflicto_no_rompe(tmp_path):
    remoto, a, b = setup(tmp_path)
    (b / "f.txt").write_text("1\nB\n3\n")
    git(b, "commit", "-qam", "b")
    git(b, "push", "-q")
    (a / "f.txt").write_text("1\nA\n3\n")
    r = sync(a)
    assert r.returncode == 0 and "conflicto" in r.stderr
    assert not (a / ".git/rebase-merge").exists()
    assert "sesión: jorge" in git(a, "log", "--format=%s")
