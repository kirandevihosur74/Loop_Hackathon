"""Deterministic mock feed — a realistic diurnal price/temperature curve.

Shape: cheap overnight, a midday solar 'belly', an expensive 16:00-21:00 evening peak.
Percentile is the current price's rank within the full 24h modeled curve.
"""

import math
from datetime import datetime


def _price_at(hour: float) -> float:
    """Modeled real-time price in cents/kWh for a fractional hour-of-day."""
    base = 18.0
    evening_peak = 22.0 * math.exp(-((hour - 18.5) ** 2) / 4.0)   # sharp evening spike
    solar_dip = -9.0 * math.exp(-((hour - 13.0) ** 2) / 8.0)      # midday solar glut
    overnight = -6.0 * math.exp(-((hour - 3.0) ** 2) / 10.0)      # cheap overnight
    return max(3.0, base + evening_peak + solar_dip + overnight)


def _temp_at(hour: float) -> float:
    return round(19.0 + 9.0 * math.sin((hour - 9.0) / 24.0 * 2 * math.pi), 1)


def mock_reading(household) -> dict:
    now = datetime.now()
    hour = now.hour + now.minute / 60.0
    curve = [_price_at(h) for h in [i / 4 for i in range(96)]]  # 15-min resolution
    price = _price_at(hour)
    lo, hi = min(curve), max(curve)
    pct = (price - lo) / (hi - lo) if hi > lo else 0.5
    return {
        "price_c_per_kwh": round(price, 2),
        "price_percentile": round(pct, 3),
        "temp_c": _temp_at(hour),
        "weather": "clear",
        "source": "mock",
    }


def apply_override(reading: dict, percentile: float) -> dict:
    """Demo helper — pin the price to a target percentile of the modeled curve."""
    pct = max(0.0, min(1.0, percentile))
    curve = sorted(_price_at(h / 4) for h in range(96))
    idx = int(pct * (len(curve) - 1))
    out = dict(reading)
    out["price_c_per_kwh"] = round(curve[idx], 2)
    out["price_percentile"] = round(pct, 3)
    out["source"] = reading.get("source", "mock") + "+override"
    return out
