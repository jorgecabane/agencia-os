#!/usr/bin/env python3
"""Hook SessionStart: le dice a Claude su session_id para la bitácora. Nunca falla (exit 0)."""
import json
import sys

try:
    print(f"session_id: {json.load(sys.stdin)['session_id']}")
except Exception:
    pass
