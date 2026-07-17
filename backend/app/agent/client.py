"""Claude wrapper for the PLAN stage, with a rule-based mock fallback.

If ANTHROPIC_API_KEY is unset the loop still produces sensible nudges via `_mock_plan`,
so the whole system demos keyless. Set the key for real reasoning.
"""

import json
from typing import Optional

from ..config import get_settings
from .prompts import PLAN_JSON_INSTRUCTION, SYSTEM_PROMPT


def plan_recommendations(context: dict, model: Optional[str] = None) -> tuple[list[dict], str]:
    """Return (recommendations, model_used).

    Uses JSON-in-text (not forced tool_use) so it works with the real Anthropic API and
    with Claude-compatible gateways that don't support tool calling. Any failure — API
    error or unparseable output — falls back to the rule-based mock brain.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return _mock_plan(context), "mock"

    import anthropic

    # Some Claude-compatible gateways sit behind a WAF that blocks the default
    # "Anthropic/Python" User-Agent — override it when a custom base_url is set.
    extra = {"default_headers": {"User-Agent": "loop-backend/1.0"}} if settings.anthropic_base_url else {}
    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url or None,   # custom gateway if set
        **extra,
    )
    model = model or settings.plan_model
    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT + "\n\n" + PLAN_JSON_INSTRUCTION,
            messages=[{"role": "user", "content": json.dumps(context, default=str)}],
        )
        text = "".join(getattr(b, "text", "") for b in message.content if getattr(b, "type", None) == "text")
        return _parse_recs(text), model
    except Exception as exc:  # never let a bad API call break the loop / demo
        return _mock_plan(context), f"mock(fallback:{type(exc).__name__})"


def _parse_recs(text: str) -> list[dict]:
    """Extract the recommendations list from the model's text (tolerates ``` fences/prose)."""
    t = text.strip()
    if "```" in t:  # strip a ```json ... ``` fence if present
        parts = t.split("```")
        t = max(parts, key=len)
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start < 0 or end <= start:
        return []
    obj = json.loads(t[start:end + 1])   # raises on bad JSON -> caller falls back to mock
    recs = obj.get("recommendations", []) if isinstance(obj, dict) else []
    return [r for r in recs if isinstance(r, dict) and r.get("kind")]


# --- rule-based fallback (also the keyless demo brain) ---------------------------------

def _mock_plan(context: dict) -> list[dict]:
    snap = context["snapshot"]
    pct = snap["price_percentile"]
    price = snap["price_c_per_kwh"]
    appliances = {a["type"]: a for a in context.get("appliances", [])}
    suppressed = set(context.get("suppressed_kinds", []))
    active = set(context.get("active_kinds", []))
    recs: list[dict] = []

    def add(kind, appliance_type, action, reason, run_hours, window, fixed_savings=None):
        if kind in suppressed or kind in active:
            return
        if appliance_type is not None and appliance_type not in appliances:
            return
        if fixed_savings is not None:
            savings = fixed_savings
        else:
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

    # Sun/shade signal (SF shadow dataset) — orientation-aware nudges.
    sun = context.get("sun")
    if sun and sun.get("period") == "day":
        temp = snap["temp_c"]
        if sun.get("in_sun") and temp >= 20 and pct >= 0.5:
            facing = _compass(sun.get("sun_az"))
            add("close_blinds", None, f"Close your {facing}-facing blinds",
                f"Direct sun on your place now (sun {facing}, {temp:.0f}°C) with power at "
                f"{price:.0f}c/kWh — blocking it cuts AC load.", 0, 90,
                fixed_savings=round(max(4.0, price * 0.6), 1))
        if not sun.get("in_sun") and any(sun.get("in_sun_next_2h", [])) and pct <= 0.4:
            add("precool_ac", "ac", "Pre-cool now while power's cheap",
                f"Sun reaches your place within ~2h; cooling now at {price:.0f}c/kWh "
                f"beats cooling into the peak.", 2.0, 120)

    recs.sort(key=lambda r: r["est_savings_c"], reverse=True)
    return recs[:3]


def _compass(azimuth) -> str:
    if azimuth is None:
        return "sun"
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[int((azimuth % 360) / 45 + 0.5) % 8]
