"""Claude wrapper for the PLAN stage, with a rule-based mock fallback.

If ANTHROPIC_API_KEY is unset the loop still produces sensible nudges via `_mock_plan`,
so the whole system demos keyless. Set the key for real reasoning.
"""

import json
from typing import Optional

from ..config import get_settings
from .prompts import SYSTEM_PROMPT
from .tools import RECOMMEND_TOOL


def plan_recommendations(context: dict, model: Optional[str] = None) -> tuple[list[dict], str]:
    """Return (recommendations, model_used)."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return _mock_plan(context), "mock"

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    model = model or settings.plan_model
    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[RECOMMEND_TOOL],
            tool_choice={"type": "tool", "name": "emit_recommendations"},
            messages=[{"role": "user", "content": json.dumps(context, default=str)}],
        )
        for block in message.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "emit_recommendations":
                return list(block.input.get("recommendations", [])), model
        return [], model
    except Exception as exc:  # never let a bad API call break the loop / demo
        fallback = _mock_plan(context)
        return fallback, f"mock(fallback:{type(exc).__name__})"


# --- rule-based fallback (also the keyless demo brain) ---------------------------------

def _mock_plan(context: dict) -> list[dict]:
    snap = context["snapshot"]
    pct = snap["price_percentile"]
    price = snap["price_c_per_kwh"]
    appliances = {a["type"]: a for a in context.get("appliances", [])}
    suppressed = set(context.get("suppressed_kinds", []))
    active = set(context.get("active_kinds", []))
    recs: list[dict] = []

    def add(kind, appliance_type, action, reason, run_hours, window):
        if kind in suppressed or kind in active or appliance_type not in appliances:
            return
        power = appliances[appliance_type]["power_kw"]
        # savings ~ energy x price gap to a ~median 15c/kWh baseline
        gap_c = max(0.0, 15.0 - price) if pct <= 0.5 else max(0.0, price - 15.0)
        savings = round(power * run_hours * gap_c, 1)
        recs.append({
            "kind": kind,
            "action": action,
            "reason": reason,
            "est_savings_c": savings,
            "credit_reward": max(1, min(20, int(savings / 5))),
            "window_minutes": window,
            "confidence": round(0.9 - abs(pct - (0.15 if pct <= 0.5 else 0.85)), 2),
        })

    if pct <= 0.35:  # cheap now — run flexible loads
        add("charge_ev_offpeak", "ev_charger", "Charge your EV now",
            f"Power is cheap ({price:.0f}c/kWh, bottom {int(pct*100)}%).", 3.0, 120)
        add("shift_dishwasher", "dishwasher", "Run the dishwasher now",
            f"Cheapest window today — {price:.0f}c/kWh.", 1.5, 90)
        add("shift_laundry", "washer", "Run a laundry load now",
            "Off-peak pricing right now.", 1.0, 90)
    elif pct >= 0.7:  # expensive now — delay / cut
        add("delay_dryer", "dryer", "Hold off on the dryer",
            f"Peak pricing ({price:.0f}c/kWh, top {int((1-pct)*100)}%). Wait ~2h.", 1.0, 120)
        add("raise_ac_setpoint", "ac", "Nudge the AC up 2°F",
            f"Grid is expensive now ({price:.0f}c/kWh) and it's {snap['temp_c']:.0f}°C out.", 2.0, 120)

    recs.sort(key=lambda r: r["est_savings_c"], reverse=True)
    return recs[:3]
