"""Credit events — the loop emits, teammates' credit/incentive system consumes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...data.models import CreditEvent, Household
from ...data.store import get_session

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/events")
def credit_events(
    household_id: int,
    since_id: int = 0,
    session: Session = Depends(get_session),
) -> list[CreditEvent]:
    """Poll new credit-award events. Pass the last-seen id as since_id to page forward."""
    return session.exec(
        select(CreditEvent)
        .where(CreditEvent.household_id == household_id, CreditEvent.id > since_id)
        .order_by(CreditEvent.id)
    ).all()


@router.get("/balance")
def credit_balance(household_id: int, session: Session = Depends(get_session)) -> dict:
    home = session.get(Household, household_id)
    if not home:
        raise HTTPException(404, "household not found")
    return {"household_id": home.id, "credits": home.credits}
