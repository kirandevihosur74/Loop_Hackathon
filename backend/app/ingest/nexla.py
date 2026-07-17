"""Read the latest reading Nexla lands for the loop (sponsor ingestion path).

Real pipeline (path B): readings land in a Nexla **nexset** via a webhook source; the loop
reads the newest record back through the **authenticated** Nexla API:

    service key  ──►  POST /token  ──►  bearer token  ──►  GET /data_sets/{nexset}/samples

`nexla/feed.py` pushes each reading into the webhook source, so real data transits Nexla.
Falls back to a legacy unauthenticated `NEXLA_SINK_URL` GET. Returns None if not configured
or unreachable, so the caller falls through to CAISO, then the mock curve — the demo never
hard-fails.
"""

import time
from typing import Optional

import httpx

from ..config import get_settings
from ..obs import get_logger

log = get_logger("ingest.nexla")

_ACCEPT = "application/vnd.nexla.api.v1+json"

# The bearer token lives ~72h; cache it in-process and refresh a minute before expiry.
_token_cache: dict = {"token": "", "exp": 0.0}


def _get_token(settings) -> Optional[str]:
    now = time.time()
    if _token_cache["token"] and now < _token_cache["exp"]:
        return _token_cache["token"]
    try:
        resp = httpx.post(
            f"{settings.nexla_api_url}/token",
            headers={"Authorization": f"Basic {settings.nexla_service_key}", "Accept": _ACCEPT},
            content=b"",
            timeout=10.0,
        )
        resp.raise_for_status()
        body = resp.json()
        token = body["access_token"]
        ttl = max(60, int(body.get("expires_in", 3600)) - 60)
        _token_cache.update(token=token, exp=now + ttl)
        log.info(f"token refreshed ttl={ttl}s")
        return token
    except Exception as exc:
        log.warning(f"token exchange failed: {type(exc).__name__}: {exc}")
        return None


def _map_row(row: Optional[dict]) -> Optional[dict]:
    """Coerce a landed row into the reading contract; None if it lacks a price."""
    if not isinstance(row, dict):
        return None
    try:
        return {
            "price_c_per_kwh": float(row["price_c_per_kwh"]),
            "price_percentile": float(row.get("price_percentile", 0.5)),
            "temp_c": float(row.get("temp_c", 20.0)),
            "weather": str(row.get("weather", "")),
            "source": "nexla",
        }
    except (KeyError, TypeError, ValueError):
        return None


def _ingest_ts(sample: dict) -> float:
    """Best-effort ingest timestamp for picking the newest record from a sample set."""
    md = sample.get("nexlaMetaData") or {}
    src = ((md.get("trackerId") or {}).get("source")) or {}
    return float(md.get("ingestTime") or src.get("initialIngestTimestamp") or 0)


def _read_nexset(settings) -> Optional[dict]:
    token = _get_token(settings)
    if not token:
        return None
    try:
        resp = httpx.get(
            f"{settings.nexla_api_url}/data_sets/{settings.nexla_nexset_id}/samples",
            headers={"Authorization": f"Bearer {token}", "Accept": _ACCEPT},
            timeout=8.0,
        )
        resp.raise_for_status()
        samples = resp.json()
        if not isinstance(samples, list) or not samples:
            return None
        newest = max(samples, key=_ingest_ts)
        # Nexla wraps each record's payload under `rawMessage`; tolerate a bare row too.
        row = _map_row(newest.get("rawMessage", newest))
        if row is None:
            log.warning("nexset sample lacked a usable price payload")
        return row
    except Exception as exc:
        log.warning(f"nexset read failed: {type(exc).__name__}: {exc}")
        return None


def read_latest(household) -> Optional[dict]:
    settings = get_settings()

    # Preferred: the authenticated Nexla nexset — the real sponsor pipeline.
    if settings.nexla_service_key and settings.nexla_nexset_id:
        row = _read_nexset(settings)
        if row is not None:
            return row

    # Legacy: an unauthenticated endpoint that returns the latest row directly.
    if settings.nexla_sink_url:
        try:
            resp = httpx.get(settings.nexla_sink_url, timeout=5.0)
            resp.raise_for_status()
            row = resp.json()
            if isinstance(row, list):
                row = row[-1] if row else None
            return _map_row(row)
        except Exception as exc:
            log.warning(f"legacy sink read failed: {type(exc).__name__}: {exc}")
            return None

    return None
