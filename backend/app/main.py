"""FastAPI entrypoint — mounts routers, inits DB, seeds demo data, optional scheduler."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data.seed import ensure_seed
from .data.store import init_db
from .api.routers import credits, household, loop, nudges
from .loop.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_seed()
    if get_settings().enable_scheduler:
        start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Loop — Fitness Tracker for Your House", version="0.1.0", lifespan=lifespan)

# Mobile web frontend (teammates) hits this from another origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(household.router)
app.include_router(nudges.router)
app.include_router(credits.router)
app.include_router(loop.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    settings = get_settings()
    if settings.use_mock_data:
        data_source = "mock"
    elif settings.nexla_service_key and settings.nexla_nexset_id:
        data_source = "nexla+caiso-fallback"       # live Nexla nexset, CAISO underneath
    else:
        data_source = "caiso-oasis+fallback"
    return {
        "ok": True,
        "service": "loop-backend",
        "agent_brain": "claude" if settings.anthropic_api_key else "mock",
        "data_source": data_source,
        "scheduler": settings.enable_scheduler,
    }
