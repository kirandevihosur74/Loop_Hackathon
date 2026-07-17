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


_COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _facing(azimuth) -> Optional[str]:
    """Compass label for the side the sun is on (which windows to act on)."""
    if azimuth is None:
        return None
    return _COMPASS[int((azimuth % 360) / 45 + 0.5) % 8]


def _hhmm(hour: int) -> str:
    return f"{hour:02d}:00"


def _contiguous(series, want: bool):
    """Yield (start_hour, end_hour) spans where in_sun == want. end_hour is exclusive-ish:
    it marks the hour the state flips (i.e. the sun window runs start..end)."""
    spans = []
    run_start = None
    for hour, in_sun in series:
        if in_sun is want and run_start is None:
            run_start = hour
        elif in_sun is not want and run_start is not None:
            spans.append((run_start, hour))
            run_start = None
    if run_start is not None:
        spans.append((run_start, series[-1][0] + 1))
    return spans


def sun_schedule(household, now: Optional[datetime] = None) -> Optional[dict]:
    """Day-ahead sun-exposure plan for a household — the "when to open/close" timeline.

    Walks the dataset's covered hours for this home's point and returns an hourly
    in-sun/shade timeline, the direct-sun windows, and a time-ordered list of blind/AC
    actions derived purely from sun geometry. Temperature/price stay in the live loop;
    this is the physical sun plan the frontend renders as "today's sun schedule".

    Returns None when the signal is unavailable (disabled / dataset or Pillow missing).
    When the home is outside the SF dataset, returns a dict with in_extent=False so the
    caller can respond clearly instead of guessing.
    """
    settings = get_settings()
    if not settings.shadow_enabled:
        return None
    meta = _meta()
    if meta is None:
        return None

    hours = sorted(t["hour"] for t in meta["times"])
    info_by_hour = {t["hour"]: t for t in meta["times"]}

    series = [(h, _shaded(household.lat, household.lon, h, meta)) for h in hours]
    series = [(h, (None if s is None else (s is False))) for h, s in series]  # True=sun

    if all(s is None for _, s in series):
        return {
            "household_id": getattr(household, "id", None),
            "lat": household.lat, "lon": household.lon,
            "date": meta.get("date"), "source": "sf-shadow-atlas",
            "in_extent": False,
            "note": "Household is outside the SF shadow dataset — no sun plan available.",
            "timeline": [], "sun_windows": [], "actions": [], "summary": "",
        }

    timeline = []
    for h, in_sun in series:
        i = info_by_hour.get(h, {})
        timeline.append({
            "hour": h, "label": _hhmm(h),
            "in_sun": in_sun,                       # True / False / None (no data)
            "sun_elev": i.get("elev"), "sun_az": i.get("az"),
            "facing": _facing(i.get("az")) if in_sun else None,
        })

    day_start, day_end = hours[0], hours[-1]
    sun_spans = _contiguous(series, True)
    shade_spans = _contiguous(series, False)

    sun_windows = []
    for s, e in sun_spans:
        mid = min(day_end, (s + e) // 2)
        sun_windows.append({
            "start": _hhmm(s), "end": _hhmm(e),
            "start_hour": s, "end_hour": e,
            "facing": _facing(info_by_hour.get(mid, {}).get("az")),
        })

    actions = []

    def act(hour, device, action, reason, target=None):
        actions.append({
            "time": _hhmm(max(day_start, min(hour, day_end))),
            "device": device, "action": action,
            "target": target, "reason": reason,
        })

    for w in sun_windows:
        face = w["facing"] or "sun-facing"
        act(w["start_hour"], "blinds", "close",
            f"Direct sun hits your {face} windows {w['start']}–{w['end']} — "
            f"close the blinds to block heat and glare and cut cooling load.",
            target=f"{face}-facing")
        # Pre-cool in the hour before the sun arrives, if there's room in the day.
        if w["start_hour"] > day_start:
            act(w["start_hour"] - 1, "ac", "precool",
                f"Pre-cool before direct sun reaches the home at {w['start']} — "
                f"cooling now beats fighting the solar gain later.")
        # When the sun leaves, reopen for daylight.
        if w["end_hour"] <= day_end:
            act(w["end_hour"], "blinds", "open",
                "Sun has moved off the home — open the blinds for daylight and skip the lights.")

    # Long afternoon/evening shade → stop cooling, use SF's natural cool-down.
    for s, e in shade_spans:
        if (e - s) >= 2 and s >= 15:
            act(s, "ac", "off",
                f"Home is shaded from {_hhmm(s)} and the evening cools off — "
                f"turn the AC off and open windows.")
            break

    if not sun_windows:
        act(day_start, "blinds", "open",
            "Your home stays shaded all day — keep the blinds open for daylight; "
            "no direct-sun heat to manage.")

    actions.sort(key=lambda a: a["time"])

    if sun_windows:
        spans_txt = ", ".join(f"{w['start']}–{w['end']} ({w['facing']})" for w in sun_windows)
        summary = f"Direct sun on your home: {spans_txt}. Shaded the rest of the day."
    else:
        summary = "Your home is in building/terrain shade all day — no direct sun."

    return {
        "household_id": getattr(household, "id", None),
        "lat": household.lat, "lon": household.lon,
        "date": meta.get("date"), "tz": meta.get("tz", "PDT"),
        "source": "sf-shadow-atlas", "in_extent": True,
        "hours_covered": [_hhmm(day_start), _hhmm(day_end)],
        "timeline": timeline,
        "sun_windows": sun_windows,
        "actions": actions,
        "summary": summary,
    }
