"""Nudges — the frontend reads active nudges and reports outcomes here.

Reporting `followed` is what awards credits and feeds the REFLECT stage next cycle.
"""

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...data.models import CreditEvent, Household, Nudge, NudgeStatus, Outcome
from ...data.store import get_session
from ...schemas import OutcomeIn

router = APIRouter(prefix="/nudges", tags=["nudges"])


@router.get("/active")
def active_nudges(household_id: int, session: Session = Depends(get_session)) -> list[Nudge]:
    return session.exec(
        select(Nudge)
        .where(Nudge.household_id == household_id, Nudge.status == NudgeStatus.active)
        .order_by(Nudge.est_savings_c.desc())
    ).all()


@router.get("")
def nudge_history(
    household_id: int, limit: int = 50, session: Session = Depends(get_session)
) -> list[Nudge]:
    return session.exec(
        select(Nudge)
        .where(Nudge.household_id == household_id)
        .order_by(Nudge.ts.desc())
        .limit(limit)
    ).all()


@router.post("/{nudge_id}/outcome")
def report_outcome(
    nudge_id: int, body: OutcomeIn, session: Session = Depends(get_session)
) -> dict:
    nudge = session.get(Nudge, nudge_id)
    if not nudge:
        raise HTTPException(404, "nudge not found")
    if nudge.status in (NudgeStatus.followed, NudgeStatus.dismissed):
        raise HTTPException(409, f"nudge already {nudge.status.value}")

    nudge.status = NudgeStatus.followed if body.followed else NudgeStatus.dismissed
    session.add(nudge)
    session.add(
        Outcome(
            nudge_id=nudge.id,
            household_id=nudge.household_id,
            followed=body.followed,
            observed_savings_c=nudge.est_savings_c if body.followed else 0.0,
        )
    )

    credit_event = None
    if body.followed and nudge.credit_reward > 0:
        home = session.get(Household, nudge.household_id)
        home.credits += nudge.credit_reward
        event = CreditEvent(
            household_id=nudge.household_id,
            nudge_id=nudge.id,
            amount=nudge.credit_reward,
            reason=f"Followed: {nudge.action}",
        )
        session.add(home)
        session.add(event)
        session.commit()
        session.refresh(event)
        credit_event = {"id": event.id, "amount": event.amount, "reason": event.reason}
    else:
        session.commit()

    return {"nudge_id": nudge.id, "status": nudge.status.value, "credit_event": credit_event}
