"""Grid state — the live price reading without running a loop cycle.

The frontend's Home screen polls this for the cheap/medium/expensive badge.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ... import ingest
from ...data.models import Household
from ...data.store import get_session

router = APIRouter(prefix="/grid", tags=["grid"])


@router.get("/state")
def grid_state(household_id: int = 1, session: Session = Depends(get_session)) -> dict:
    home = session.get(Household, household_id)
    if not home:
        raise HTTPException(404, "household not found")
    reading = ingest.get_reading(home)
    pct = reading["price_percentile"]
    state = "cheap" if pct <= 0.35 else ("expensive" if pct >= 0.7 else "medium")
    return {
        "state": state,
        "price_cents": reading["price_c_per_kwh"],
        "price_percentile": pct,
        "temp_c": reading.get("temp_c"),
        "source": reading.get("source"),
    }
