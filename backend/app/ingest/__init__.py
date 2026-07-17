"""Ingest layer — one function the loop calls to get the current world reading.

Order: Nexla sink (sponsor) -> direct API fallback -> mock. `use_mock_data` short-circuits
to mock so the demo is deterministic and never depends on a live feed.
"""

from typing import Optional

from ..config import get_settings
from ..data.models import Household
from . import caiso, mock, nexla, pricing, weather


def get_reading(household: Household, override_percentile: Optional[float] = None) -> dict:
    """Return {price_c_per_kwh, price_percentile, temp_c, weather, source}.

    Real-data order: Nexla sink → CAISO OASIS (ground truth) → GridStatus → mock.
    `use_mock_data` short-circuits to the mock curve for offline/deterministic demos.
    """
    settings = get_settings()
    reading: Optional[dict] = None

    if not settings.use_mock_data:
        reading = nexla.read_latest(household)          # sponsor path
        if reading is None and household.iso_region.upper() == "CAISO":
            reading = caiso.fetch_reading(household)     # real CAISO ground truth
        if reading is None:
            price = pricing.fetch_lmp(household)         # gridstatus direct fallback
            wx = weather.fetch(household)
            if price is not None:
                reading = {**price, **(wx or {}), "source": price.get("source", "gridstatus")}

    if reading is None:
        reading = mock.mock_reading(household)

    if override_percentile is not None:
        reading = mock.apply_override(reading, override_percentile)
    return reading
