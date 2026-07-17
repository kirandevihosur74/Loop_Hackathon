"""Observability: logging setup, request middleware, and in-process metrics.

Logs — one readable line per event, tagged by module:
    2026-07-17 14:03:11 INFO  [loop]   cycle household=1 ... total=41837ms
Level via LOG_LEVEL env (default INFO; DEBUG shows payload details).

Metrics — thread-safe in-process counters/timings, exposed at GET /metrics:
    requests per route (count, errors, avg/max ms), loop stage timings,
    ingest source wins/failures, agent brain calls/fallbacks, nudge outcomes.
Reset with POST /metrics/reset between test runs.
"""

import logging
import os
import sys
import threading
import time
from collections import defaultdict

# ---------------------------------------------------------------- logging ----

_FMT = "%(asctime)s %(levelname)-5s [%(name)s] %(message)s"
_DATEFMT = "%H:%M:%S"


def setup_logging() -> None:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    root = logging.getLogger("app")
    if root.handlers:  # idempotent (uvicorn reload)
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FMT, _DATEFMT))
    root.addHandler(handler)
    root.setLevel(level)
    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"app.{name}")


# ---------------------------------------------------------------- metrics ----

class _Metrics:
    """Tiny thread-safe registry: counters + duration aggregates."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        with getattr(self, "_lock", threading.Lock()):
            self.counters: dict[str, int] = defaultdict(int)
            self.timings: dict[str, dict] = defaultdict(
                lambda: {"count": 0, "total_ms": 0.0, "max_ms": 0.0}
            )
            self.started_at = time.time()

    def inc(self, key: str, n: int = 1) -> None:
        with self._lock:
            self.counters[key] += n

    def observe(self, key: str, ms: float) -> None:
        with self._lock:
            t = self.timings[key]
            t["count"] += 1
            t["total_ms"] += ms
            t["max_ms"] = max(t["max_ms"], ms)

    def snapshot(self) -> dict:
        with self._lock:
            timings = {
                k: {
                    "count": v["count"],
                    "avg_ms": round(v["total_ms"] / v["count"], 1) if v["count"] else 0.0,
                    "max_ms": round(v["max_ms"], 1),
                }
                for k, v in sorted(self.timings.items())
            }
            return {
                "uptime_s": round(time.time() - self.started_at, 1),
                "counters": dict(sorted(self.counters.items())),
                "timings": timings,
            }


metrics = _Metrics()


class timed:
    """Context manager: time a block into metrics (and return elapsed ms)."""

    def __init__(self, key: str):
        self.key = key
        self.ms = 0.0

    def __enter__(self):
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.ms = (time.perf_counter() - self._t0) * 1000
        metrics.observe(self.key, self.ms)
        return False


# ------------------------------------------------------------- middleware ----

_req_log = get_logger("http")


async def request_middleware(request, call_next):
    """Log every request with duration + status; count into metrics."""
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        ms = (time.perf_counter() - t0) * 1000
        metrics.inc("http.exceptions")
        _req_log.exception(f"{request.method} {request.url.path} UNHANDLED after {ms:.0f}ms")
        raise
    ms = (time.perf_counter() - t0) * 1000
    route = f"{request.method} {request.url.path}"
    metrics.observe(f"http {route}", ms)
    if response.status_code >= 500:
        metrics.inc("http.5xx")
        _req_log.error(f"{route} -> {response.status_code} in {ms:.0f}ms")
    elif response.status_code >= 400:
        metrics.inc("http.4xx")
        _req_log.warning(f"{route} -> {response.status_code} in {ms:.0f}ms")
    else:
        _req_log.info(f"{route} -> {response.status_code} in {ms:.0f}ms")
    return response
