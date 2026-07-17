"""ACT — turn recommendations into persisted Nudges.

Filters applied (belt-and-suspenders; PLAN is also told about these):
- suppressed kinds are dropped (fatigue guard)
- kinds with an already-active nudge are skipped (no duplicates)
- within this batch, keep only the first nudge per kind
Credits are NOT awarded here — only when the user follows a nudge (see api/routers/nudges.py).
"""

from datetime import timedelta

from sqlmodel import Session

from ...data.models import Nudge, NudgeStatus, utcnow


def act(session: Session, household_id: int, recommendations: list[dict], context: dict) -> list[Nudge]:
    suppressed = set(context.get("suppressed_kinds", []))
    taken = set(context.get("active_kinds", []))
    created: list[Nudge] = []
    now = utcnow()

    for rec in recommendations:
        kind = rec.get("kind")
        if not kind or kind in suppressed or kind in taken:
            continue
        taken.add(kind)  # dedupe within this batch too

        window_minutes = int(rec.get("window_minutes", 90))
        nudge = Nudge(
            household_id=household_id,
            kind=kind,
            action=rec.get("action", ""),
            reason=rec.get("reason", ""),
            est_savings_c=float(rec.get("est_savings_c", 0.0)),
            credit_reward=int(rec.get("credit_reward", 1)),
            window_start=now,
            window_end=now + timedelta(minutes=window_minutes),
            confidence=float(rec.get("confidence", 0.5)),
            status=NudgeStatus.active,
        )
        session.add(nudge)
        created.append(nudge)

    if created:
        session.commit()
        for nudge in created:
            session.refresh(nudge)
    return created
