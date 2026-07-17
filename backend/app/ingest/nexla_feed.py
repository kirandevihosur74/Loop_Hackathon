"""Feeder — push the live reading INTO Nexla so the loop can read it back out (path B).

Pulls the current reading straight from CAISO OASIS (the same ground truth the loop uses),
then POSTs it to the Nexla webhook source at `NEXLA_INGEST_URL`. Nexla lands it in the
nexset the loop reads via `ingest/nexla.read_latest`. This is what makes real data *transit
Nexla* end to end:

    CAISO OASIS ─► feeder ─► Nexla webhook source ─► nexset ─► loop (read_latest)

Run once for a demo, or on an interval to keep the nexset fresh:

    cd backend && PYTHONPATH=. .venv/bin/python -m app.ingest.nexla_feed            # one push
    cd backend && PYTHONPATH=. .venv/bin/python -m app.ingest.nexla_feed --interval 60 --count 10
"""

import argparse
import time
from types import SimpleNamespace

import httpx

from ..config import get_settings
from . import caiso, mock


def _current_reading(household) -> dict:
    """CAISO ground truth if reachable, else the deterministic mock curve."""
    reading = caiso.fetch_reading(household)
    return reading if reading is not None else mock.mock_reading(household)


def push_once(household=None) -> dict:
    settings = get_settings()
    if not settings.nexla_ingest_url:
        raise SystemExit("NEXLA_INGEST_URL is not set — see nexla/RESOURCES.local.md")

    household = household or SimpleNamespace(id=1, lat=37.77, lon=-122.42, iso_region="CAISO")
    reading = _current_reading(household)
    payload = {
        "price_c_per_kwh": reading["price_c_per_kwh"],
        "price_percentile": reading["price_percentile"],
        "temp_c": reading["temp_c"],
        "weather": reading["weather"],
    }
    resp = httpx.post(settings.nexla_ingest_url, json=payload, timeout=15.0)
    resp.raise_for_status()
    result = resp.json()
    print(f"pushed {payload}  (from {reading.get('source')}) -> {result}")
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description="Push live readings into Nexla (path B feeder).")
    ap.add_argument("--interval", type=float, default=0.0, help="seconds between pushes (0 = one-shot)")
    ap.add_argument("--count", type=int, default=1, help="number of pushes (with --interval)")
    args = ap.parse_args()

    for i in range(max(1, args.count)):
        push_once()
        if args.interval > 0 and i < args.count - 1:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
