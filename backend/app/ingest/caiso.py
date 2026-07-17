"""Real CAISO ground-truth prices via the OASIS SingleZip API (keyless, official).

Same LMP data that powers the CAISO "Today's Outlook > Prices" page. We pull the last
24h of real-time 5-minute LMP for the household's trading hub, take the latest interval as
the current price, and compute a *real* price percentile from the day's distribution
(so "cheapest 10% of today" is grounded in actual prices, not a modeled curve).

Docs: http://oasis.caiso.com/oasisapi  |  report PRC_INTVL_LMP, market_run_id=RTM.
Returns None on any failure so the caller falls back (gridstatus → mock).
"""

import csv
import io
import time
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from ..config import get_settings
from . import weather

OASIS_URL = "https://oasis.caiso.com/oasisapi/SingleZip"

# CAISO trading hubs (aggregated pricing nodes)
HUB_NP15 = "TH_NP15_GEN-APND"   # Northern California
HUB_SP15 = "TH_SP15_GEN-APND"   # Southern California

# OASIS throttles ~1 request / 5s per client; the loop runs every 30m-2h, but the demo
# hammers /loop/run — cache the last price briefly to stay well under the limit.
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 60.0


def _node_for(household) -> str:
    settings = get_settings()
    if settings.caiso_node:
        return settings.caiso_node
    lat = getattr(household, "lat", None) or 0.0
    return HUB_NP15 if lat >= 35.5 else HUB_SP15   # rough NorCal/SoCal split


def fetch_reading(household, _clock: float | None = None) -> Optional[dict]:
    """Return {price_c_per_kwh, price_percentile, temp_c, weather, source} or None."""
    node = _node_for(household)
    now = _clock if _clock is not None else time.time()

    cached = _CACHE.get(node)
    if cached and now - cached[0] < _CACHE_TTL:
        base = dict(cached[1])
    else:
        base = _fetch_price(node)
        if base is None:
            return None
        _CACHE[node] = (now, base)

    wx = weather.fetch(household) or {}   # best-effort temp/weather overlay
    return {**base, **wx}


def _fetch_price(node: str) -> Optional[dict]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    params = {
        "queryname": "PRC_INTVL_LMP",
        "version": "1",
        "market_run_id": "RTM",
        "node": node,
        "resultformat": "6",   # CSV
        "startdatetime": start.strftime("%Y%m%dT%H:%M-0000"),
        "enddatetime": end.strftime("%Y%m%dT%H:%M-0000"),
    }
    try:
        resp = httpx.get(OASIS_URL, params=params, timeout=40.0, follow_redirects=True)
        resp.raise_for_status()
        archive = zipfile.ZipFile(io.BytesIO(resp.content))
        text = archive.read(archive.namelist()[0]).decode("utf-8", "replace")
    except Exception:
        return None

    # Keep total-LMP rows (LMP_TYPE == LMP); price ($/MWh) sits in the "MW" column.
    series: list[tuple[str, float]] = []
    for row in csv.DictReader(io.StringIO(text)):
        if row.get("LMP_TYPE") != "LMP":
            continue
        try:
            series.append((row["INTERVALSTARTTIME_GMT"], float(row["MW"])))
        except (KeyError, ValueError):
            continue
    if not series:
        return None

    series.sort(key=lambda r: r[0])
    latest_mwh = series[-1][1]
    prices = [p for _, p in series]
    percentile = sum(1 for p in prices if p <= latest_mwh) / len(prices)

    return {
        "price_c_per_kwh": round(latest_mwh / 10.0, 2),   # $/MWh → cents/kWh
        "price_percentile": round(percentile, 3),
        "source": f"caiso-oasis:{node.split('_')[1]}",    # e.g. caiso-oasis:NP15
    }
