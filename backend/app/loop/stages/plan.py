"""PLAN — ask the agent brain (Claude, or mock fallback) for nudges given the context."""

from ...agent.client import plan_recommendations


def plan(context: dict) -> tuple[list[dict], str]:
    """Return (recommendations, model_used)."""
    return plan_recommendations(context)
