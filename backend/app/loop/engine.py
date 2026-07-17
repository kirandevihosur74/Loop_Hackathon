"""LoopEngine — one cycle of the autonomous agent loop.

OBSERVE (snapshot) → REFLECT (self-correct) → OBSERVE (assemble) → PLAN → ACT.
Reflect runs before context assembly so PLAN sees the freshly-updated suppressed set.
"""

from typing import Optional

from sqlmodel import Session

from .. import notify
from ..data.models import Household, LoopRun
from ..obs import get_logger, metrics, timed
from .stages import act as act_stage
from .stages import observe as observe_stage
from .stages import plan as plan_stage
from .stages import reflect as reflect_stage

log = get_logger("loop")


def run_cycle(session: Session, household: Household, override_percentile: Optional[float] = None) -> dict:
    metrics.inc("loop.cycles")
    with timed("loop.cycle") as t_cycle:
        # OBSERVE (gather reading)
        with timed("loop.observe"):
            snapshot = observe_stage.take_snapshot(session, household, override_percentile)

        # REFLECT (score prior nudges, update learned patterns) — self-correction
        with timed("loop.reflect"):
            scored = reflect_stage.reflect(session, household.id)

        # OBSERVE (assemble context, now reflecting updated patterns)
        context = observe_stage.build_context(session, household, snapshot)
        log.debug(
            f"context household={household.id} active={context['active_kinds']} "
            f"suppressed={context['suppressed_kinds']} sun={'yes' if context.get('sun') else 'no'}"
        )

        # PLAN (agent brain)
        with timed("loop.plan"):
            recommendations, model_used = plan_stage.plan(context)

        # ACT (persist nudges)
        with timed("loop.act"):
            created = act_stage.act(session, household.id, recommendations, context)
        dropped = len(recommendations) - len(created)
        if dropped:
            metrics.inc("loop.nudges.deduped", dropped)
        metrics.inc("loop.nudges.created", len(created))

        # DELIVER — send the highest-value nudge via Zero.xyz (best-effort; one per cycle to
        # limit cost/spam). No-op unless ZERO_ENABLED; dry-run by default (no USDC spent).
        notifications = []
        if created and notify.available()[0]:
            top = max(created, key=lambda n: n.est_savings_c)
            message = f"⚡ {top.action} — {top.reason} (+{top.credit_reward} credits)"
            result = notify.deliver_sms(getattr(household, "phone", "") or "", message)
            notifications.append({"nudge_id": top.id, **result})
            log.info(f"deliver nudge={top.id} result={result.get('reason') or result.get('delivered')}")

    run = LoopRun(
        household_id=household.id,
        nudges_created=len(created),
        outcomes_scored=scored,
        suppressed_kinds=",".join(context["suppressed_kinds"]),
        model_used=model_used,
        price_c_per_kwh=snapshot.price_c_per_kwh,
        price_percentile=snapshot.price_percentile,
        ok=True,
        note=f"{len(recommendations)} recs → {len(created)} nudges",
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    log.info(
        f"cycle household={household.id} run={run.id} source={snapshot.source} "
        f"price={snapshot.price_c_per_kwh}c pct={snapshot.price_percentile} model={model_used} "
        f"recs={len(recommendations)} created={len(created)} scored={scored} "
        f"suppressed={context['suppressed_kinds'] or '-'} total={t_cycle.ms:.0f}ms"
    )

    return {
        "loop_run_id": run.id,
        "model_used": model_used,
        "snapshot": {
            "price_c_per_kwh": snapshot.price_c_per_kwh,
            "price_percentile": snapshot.price_percentile,
            "temp_c": snapshot.temp_c,
            "source": snapshot.source,
        },
        "outcomes_scored": scored,
        "suppressed_kinds": context["suppressed_kinds"],
        "notifications": notifications,
        "nudges_created": [
            {
                "id": n.id,
                "kind": n.kind,
                "action": n.action,
                "reason": n.reason,
                "est_savings_c": n.est_savings_c,
                "credit_reward": n.credit_reward,
                "window_end": n.window_end,
            }
            for n in created
        ],
    }
