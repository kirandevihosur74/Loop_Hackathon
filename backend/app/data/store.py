"""DB engine + session helpers. Import `models` so tables register before create_all."""

from sqlmodel import Session, SQLModel, create_engine

from ..config import get_settings
from . import models  # noqa: F401  (registers tables on SQLModel.metadata)

_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}
engine = create_engine(_settings.database_url, echo=False, connect_args=_connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    """FastAPI dependency — yields a session."""
    with Session(engine) as session:
        yield session
