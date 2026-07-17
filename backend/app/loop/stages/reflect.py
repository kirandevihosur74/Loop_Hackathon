"""REFLECT — the self-correction stage.

1. Expire active nudges whose window has passed with no user action → an ignored Outcome.
2. Recompute per-kind responsiveness from all outcomes into UserPattern rows.
3. Expose suppressed_kinds(): kinds the user reliably ignores, so PLAN/ACT stop showing them.

This is what makes the loop *close*: dismiss a kind enough and it disappears next cycle.
"""

import json
from datetime import datetime, timezone

from sqlmodel import Session, select

from ...data.models import Nudge, NudgeStatus, Outcome, UserPattern, utcnow

SUPPRESS_MIN_SAMPLES = 3
SUPPRESS_RATE = 0.34          # follow-rate below this → suppress the kind
_PREFIX = "responsiveness:"


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def reflect(session: Session, household_id: int) -> int:
    """Score overdue nudges and refresh responsiveness patterns. Returns #scored."""
    now = utcnow()
    scored = 0

    overdue = session.exec(
        select(Nudge).where(
            Nudge.household_id == household_id,
            Nudge.status == NudgeStatus.active,
        )
    ).all()
    for nudge in overdue:
        if nudge.window_end and _aware(nudge.window_end) < now:
            nudge.status = NudgeStatus.expired
            session.add(nudge)
            session.add(Outcome(nudge_id=nudge.id, household_id=household_id, followed=False))
            scored += 1
    if scored:
        session.commit()

    _recompute_patterns(session, household_id)
    return scored


def _recompute_patterns(session: Session, household_id: int) -> None:
    rows = session.exec(
        select(Outcome, Nudge)
        .where(Outcome.household_id == household_id, Outcome.nudge_id == Nudge.id)
    ).all()

    agg: dict[str, list[int]] = {}   # kind -> [followed, total]
    for outcome, nudge in rows:
        fc = agg.setdefault(nudge.kind, [0, 0])
        fc[0] += 1 if outcome.followed else 0
        fc[1] += 1

    for kind, (followed, total) in agg.items():
        rate = followed / total if total else 0.0
        key = _PREFIX + kind
        existing = session.exec(
            select(UserPattern).where(
                UserPattern.household_id == household_id, UserPattern.key == key
            )
        ).first()
        payload = json.dumps({"followed": followed, "total": total, "rate": round(rate, 3)})
        if existing:
            existing.value = payload
            existing.updated_at = utcnow()
            session.add(existing)
        else:
            session.add(UserPattern(household_id=household_id, key=key, value=payload))
    session.commit()


def suppressed_kinds(session: Session, household_id: int) -> list[str]:
    patterns = session.exec(
        select(UserPattern).where(
            UserPattern.household_id == household_id,
            UserPattern.key.startswith(_PREFIX),
        )
    ).all()
    out = []
    for p in patterns:
        try:
            data = json.loads(p.value)
        except (ValueError, TypeError):
            continue
        if data.get("total", 0) >= SUPPRESS_MIN_SAMPLES and data.get("rate", 1.0) < SUPPRESS_RATE:
            out.append(p.key[len(_PREFIX):])
    return sorted(out)
