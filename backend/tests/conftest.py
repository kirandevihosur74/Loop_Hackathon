"""Point tests at an isolated DB before the app imports its engine."""

import os
import pathlib

os.environ["DATABASE_URL"] = "sqlite:///./test_loop.db"
os.environ["USE_MOCK_DATA"] = "true"
os.environ["ANTHROPIC_API_KEY"] = ""       # force the deterministic mock brain

_db = pathlib.Path(__file__).resolve().parent.parent / "test_loop.db"
if _db.exists():
    _db.unlink()
