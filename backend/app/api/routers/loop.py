"""Loop control — manual trigger for the demo, plus status for metrics."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...data.models import Household, LoopRun
from ...data.store import get_session
from ...loop.engine import run_cycle
from ...schemas import RunLoopIn

router = APIRouter(prefix="/loop", tags=["loop"])


@router.post("/run")
def run_loop(
    household_id: int,
    body: RunLoopIn | None = None,
    session: Session = Depends(get_session),
) -> dict:
    home = session.get(Household, household_id)
    if not home:
        raise HTTPException(404, "household not found")
    override = body.force_price_percentile if body else None
    return run_cycle(session, home, override_percentile=override)


@router.get("/status")
def loop_status(household_id: int, session: Session = Depends(get_session)) -> dict:
    runs = session.exec(
        select(LoopRun)
        .where(LoopRun.household_id == household_id)
        .order_by(LoopRun.ts.desc())
        .limit(10)
    ).all()
    last = runs[0] if runs else None
    return {
        "household_id": household_id,
        "total_runs": len(runs),
        "last_run": last,
        "recent_runs": runs,
    }
