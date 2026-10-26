import json
import subprocess
import sys
from pathlib import Path

HOOK = Path(__file__).parent.parent / ".claude/hooks/session_start.py"


def test_imprime_session_id():
    r = subprocess.run([sys.executable, str(HOOK)], input=json.dumps({"session_id": "abc-123"}),
                       capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout.strip() == "session_id: abc-123"
