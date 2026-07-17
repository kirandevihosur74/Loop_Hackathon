"""Direct weather fallback via Open-Meteo (free, no key) — Phase 3."""

from typing import Optional

import httpx


def fetch(household) -> Optional[dict]:
    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": household.lat,
                "longitude": household.lon,
                "current": "temperature_2m,weather_code",
            },
            timeout=8.0,
        )
        resp.raise_for_status()
        cur = resp.json().get("current", {})
        return {"temp_c": float(cur.get("temperature_2m", 20.0)), "weather": str(cur.get("weather_code", ""))}
    except Exception:
        return None
