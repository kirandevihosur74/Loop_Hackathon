"""FastAPI entrypoint — mounts routers, inits DB, seeds demo data, optional scheduler."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data.seed import ensure_seed
from .data.store import init_db
from .api.routers import credits, grid, household, loop, nudges
from .loop.scheduler import start_scheduler, stop_scheduler
from .obs import get_logger, metrics, request_middleware, setup_logging

setup_logging()
log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    hid = ensure_seed()
    settings = get_settings()
    log.info(
        f"startup household={hid} brain={'claude' if settings.anthropic_api_key else 'mock'} "
        f"base_url={'gateway' if settings.anthropic_base_url else 'anthropic'} "
        f"mock_data={settings.use_mock_data} nexla={'on' if settings.nexla_service_key and settings.nexla_nexset_id else 'off'} "
        f"scheduler={settings.enable_scheduler}"
    )
    if settings.enable_scheduler:
        start_scheduler()
    yield
    stop_scheduler()
    log.info("shutdown")


app = FastAPI(title="Loop — Fitness Tracker for Your House", version="0.1.0", lifespan=lifespan)

# Mobile web frontend (teammates) hits this from another origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging + per-route metrics (see app/obs.py; GET /metrics to read).
app.middleware("http")(request_middleware)

app.include_router(household.router)
app.include_router(nudges.router)
app.include_router(credits.router)
app.include_router(loop.router)
app.include_router(grid.router)


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


@app.get("/metrics", tags=["meta"])
def get_metrics() -> dict:
    """In-process counters + timings: per-route latency, loop stages, ingest sources."""
    return metrics.snapshot()


@app.post("/metrics/reset", tags=["meta"])
def reset_metrics() -> dict:
    metrics.reset()
    return {"reset": True}
