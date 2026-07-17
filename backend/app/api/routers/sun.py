"""Sun plan — the day-ahead "when to open/close blinds & run AC" schedule.

Derived from the SF shadow dataset for a household's location. The frontend renders
`timeline` (hourly sun/shade) and `actions` (time-ordered blind/AC suggestions).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ...data.models import Household
from ...data.store import get_session
from ...ingest import shadow

router = APIRouter(prefix="/household", tags=["sun"])


@router.get("/{household_id}/sun-plan")
def sun_plan(household_id: int, session: Session = Depends(get_session)) -> dict:
    home = session.get(Household, household_id)
    if not home:
        raise HTTPException(404, "household not found")

    plan = shadow.sun_schedule(home)
    if plan is None:
        return {
            "available": False,
            "reason": "sun signal disabled or shadow dataset unavailable",
            "household_id": household_id,
        }
    return {"available": True, **plan}
