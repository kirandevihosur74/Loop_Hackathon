"""OBSERVE — pull a world reading, persist a Snapshot, assemble the agent's context."""

from typing import Optional

from sqlmodel import Session, select

from ... import ingest
from ...data.models import Appliance, Household, Nudge, NudgeStatus, Outcome, Snapshot
from .reflect import suppressed_kinds


def take_snapshot(session: Session, household: Household, override_percentile: Optional[float] = None) -> Snapshot:
    reading = ingest.get_reading(household, override_percentile=override_percentile)
    snap = Snapshot(household_id=household.id, **reading)
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return snap


def build_context(session: Session, household: Household, snapshot: Snapshot) -> dict:
    appliances = session.exec(
        select(Appliance).where(Appliance.household_id == household.id)
    ).all()

    active = session.exec(
        select(Nudge).where(Nudge.household_id == household.id, Nudge.status == NudgeStatus.active)
    ).all()

    recent_outcomes = session.exec(
        select(Outcome, Nudge)
        .where(Outcome.household_id == household.id, Outcome.nudge_id == Nudge.id)
        .order_by(Outcome.ts.desc())
        .limit(10)
    ).all()

    return {
        "household": {"iso_region": household.iso_region, "tariff_plan": household.tariff_plan},
        "snapshot": {
            "price_c_per_kwh": snapshot.price_c_per_kwh,
            "price_percentile": snapshot.price_percentile,
            "temp_c": snapshot.temp_c,
            "weather": snapshot.weather,
            "source": snapshot.source,
        },
        "appliances": [
            {"type": a.type, "model": a.model, "power_kw": a.power_kw, "flexible": a.flexible}
            for a in appliances
        ],
        "active_kinds": sorted({n.kind for n in active}),
        "suppressed_kinds": suppressed_kinds(session, household.id),
        "recent_outcomes": [
            {"kind": n.kind, "followed": o.followed} for o, n in recent_outcomes
        ],
    }
