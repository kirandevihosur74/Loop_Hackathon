"""Sun/shade signal from the SF shadow dataset (datasets/shadow_data).

Given a household's lat/lon and the current SF-local hour, answer: is the home in direct
sun or in building shadow, plus the sun's elevation/azimuth and a short look-ahead. This is
the "physical context / home orientation" input — it powers close-blinds / pre-cool nudges.

Reuses the dataset's georeferencing (meta.json) + hourly boolean shade layers
(shade_HH00.png, alpha>0 = shadow). Returns None whenever it can't answer (dataset or
Pillow missing, non-SF household, night) so the loop degrades gracefully, exactly like the
CAISO/mock ingest fallbacks.
"""

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

from ..config import get_settings

_DAY_START, _DAY_END = 7, 18   # hours the dataset covers


def _dataset_dir() -> Optional[Path]:
    settings = get_settings()
    base = Path(settings.shadow_data_dir) if settings.shadow_data_dir \
        else Path(__file__).resolve().parents[3] / "datasets" / "shadow_data"
    return base if (base / "meta.json").exists() else None


@lru_cache(maxsize=1)
def _meta() -> Optional[dict]:
    d = _dataset_dir()
    return json.load(open(d / "meta.json")) if d else None


@lru_cache(maxsize=16)
def _layer(hour: int):
    """Load an hourly shade PNG once (cached). Requires Pillow."""
    from PIL import Image  # lazy — missing Pillow just disables the signal

    d = _dataset_dir()
    img = Image.open(d / f"shade_{hour:02d}00.png").convert("RGBA")
    img.load()
    return img


def _sf_local(now: datetime) -> datetime:
    try:
        from zoneinfo import ZoneInfo

        return now.astimezone(ZoneInfo("America/Los_Angeles"))
    except Exception:
        return now.astimezone(timezone(timedelta(hours=-7)))  # PDT fallback


def _shaded(lat: float, lon: float, hour: int, meta: dict) -> Optional[bool]:
    """True = in shadow, False = in sun, None = outside the dataset extent."""
    x = (lon - meta["W"]) * meta["M_LON"] / meta["mpp"]
    y = (meta["N"] - lat) * meta["M_LAT"] / meta["mpp"]
    if not (0 <= x < meta["width"] and 0 <= y < meta["height"]):
        return None
    try:
        alpha = _layer(hour).getpixel((int(x), int(y)))[3]
    except Exception:
        return None
    return alpha > 0


def sun_state(household, now: Optional[datetime] = None) -> Optional[dict]:
    """Return the sun/shade context block for a household, or None if unavailable."""
    settings = get_settings()
    if not settings.shadow_enabled:
        return None
    meta = _meta()
    if meta is None:
        return None

    local = _sf_local(now or datetime.now(timezone.utc))
    hour = local.hour

    if hour < _DAY_START or hour > _DAY_END:
        return {
            "in_sun": False, "period": "night", "sun_elev": 0.0, "sun_az": None,
            "in_sun_next_2h": [False, False], "source": "sf-shadow-atlas",
        }

    now_shade = _shaded(household.lat, household.lon, hour, meta)
    if now_shade is None:
        return None  # non-SF household / outside extent → no sun signal

    times = {t["hour"]: t for t in meta["times"]}
    info = times.get(hour, {})
    look_ahead = []
    for h in (hour + 1, hour + 2):
        s = _shaded(household.lat, household.lon, h, meta) if _DAY_START <= h <= _DAY_END else None
        look_ahead.append(s is False)

    return {
        "in_sun": now_shade is False,
        "period": "day",
        "sun_elev": info.get("elev"),
        "sun_az": info.get("az"),
        "in_sun_next_2h": look_ahead,
        "source": "sf-shadow-atlas",
    }
