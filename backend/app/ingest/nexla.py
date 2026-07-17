"""Read the latest row Nexla lands for a household (Phase 3).

Nexla Express builds the pipeline from a prompt; the Agent CLI activates it; it lands
rows at NEXLA_SINK_URL. This reads the freshest row. Returns None if not configured or
unreachable so the caller falls back to a direct fetch, then mock.
"""

from typing import Optional

import httpx

from ..config import get_settings


def read_latest(household) -> Optional[dict]:
    settings = get_settings()
    if not settings.nexla_sink_url:
        return None
    try:
        resp = httpx.get(settings.nexla_sink_url, timeout=5.0)
        resp.raise_for_status()
        row = resp.json()
        if isinstance(row, list):
            row = row[-1] if row else None
        if not row:
            return None
        return {
            "price_c_per_kwh": float(row["price_c_per_kwh"]),
            "price_percentile": float(row.get("price_percentile", 0.5)),
            "temp_c": float(row.get("temp_c", 20.0)),
            "weather": row.get("weather", ""),
            "source": "nexla",
        }
    except Exception:
        return None
