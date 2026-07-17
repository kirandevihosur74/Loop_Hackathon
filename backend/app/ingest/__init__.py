"""Ingest layer — one function the loop calls to get the current world reading.

Order: Nexla sink (sponsor) -> CAISO OASIS -> GridStatus -> mock. `use_mock_data`
short-circuits to mock so the demo is deterministic and never depends on a live feed.
Every hop logs, so a reading's provenance is visible in the server output.
"""

from typing import Optional

from ..config import get_settings
from ..data.models import Household
from ..obs import get_logger, metrics, timed
from . import caiso, mock, nexla, pricing, weather

log = get_logger("ingest")


def get_reading(household: Household, override_percentile: Optional[float] = None) -> dict:
    """Return {price_c_per_kwh, price_percentile, temp_c, weather, source}."""
    settings = get_settings()
    reading: Optional[dict] = None

    if not settings.use_mock_data:
        with timed("ingest.nexla") as t:
            reading = nexla.read_latest(household)          # sponsor path
        if reading is None:
            log.debug(f"nexla miss ({t.ms:.0f}ms) — falling through")
            metrics.inc("ingest.nexla.miss")

        if reading is None and household.iso_region.upper() == "CAISO":
            with timed("ingest.caiso") as t:
                reading = caiso.fetch_reading(household)     # real CAISO ground truth
            if reading is None:
                log.warning(f"caiso miss ({t.ms:.0f}ms) — falling through")
                metrics.inc("ingest.caiso.miss")

        if reading is None:
            with timed("ingest.gridstatus"):
                price = pricing.fetch_lmp(household)         # gridstatus direct fallback
                wx = weather.fetch(household)
            if price is not None:
                reading = {**price, **(wx or {}), "source": price.get("source", "gridstatus")}
            else:
                metrics.inc("ingest.gridstatus.miss")

    if reading is None:
        reading = mock.mock_reading(household)
        if not settings.use_mock_data:
            log.warning("all live sources failed — using mock curve")

    if override_percentile is not None:
        reading = mock.apply_override(reading, override_percentile)

    src = reading["source"]
    metrics.inc(f"ingest.source.{src.split(':')[0].split('+')[0]}")
    log.info(
        f"reading household={household.id} source={src} "
        f"price={reading['price_c_per_kwh']}c pct={reading['price_percentile']} temp={reading.get('temp_c')}"
    )
    return reading
