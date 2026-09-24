import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("OFFLINE", "1")          # tests are deterministic: never call a real model
os.environ["TRACE_FILE"] = str(ROOT / "runs" / "test_traces.jsonl")
