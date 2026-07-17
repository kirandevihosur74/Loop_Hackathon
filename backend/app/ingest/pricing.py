"""Direct US-ISO real-time price fallback via GridStatus.io (Phase 3).

Kept intentionally thin: returns {price_c_per_kwh, price_percentile, source} or None.
Percentile requires a recent-window history; Phase 3 wires the /prices range query.
"""

from typing import Optional

import httpx

from ..config import get_settings

_ISO_DATASET = {
    "CAISO": "caiso_lmp_real_time_5_min",
    "PJM": "pjm_lmp_real_time_5_min",
    "ERCOT": "ercot_spp_real_time_15_min",
}


def fetch_lmp(household) -> Optional[dict]:
    settings = get_settings()
    if not settings.gridstatus_api_key:
        return None
    dataset = _ISO_DATASET.get(household.iso_region)
    if not dataset:
        return None
    try:
        resp = httpx.get(
            f"https://api.gridstatus.io/v1/datasets/{dataset}/query",
            params={"limit": 1, "order": "desc"},
            headers={"x-api-key": settings.gridstatus_api_key},
            timeout=8.0,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        if not rows:
            return None
        lmp_mwh = float(rows[0].get("lmp", 0.0))       # $/MWh
        return {"price_c_per_kwh": round(lmp_mwh / 10.0, 2), "price_percentile": 0.5, "source": "gridstatus"}
    except Exception:
        return None
