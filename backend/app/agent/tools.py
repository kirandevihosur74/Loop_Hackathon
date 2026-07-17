"""Structured-output tool schema — forces the model to return typed nudges, no parsing."""

RECOMMEND_TOOL = {
    "name": "emit_recommendations",
    "description": "Emit the energy-saving nudges to show the user right now (0-3).",
    "input_schema": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {
                            "type": "string",
                            "description": "Stable category slug, e.g. shift_dishwasher, "
                            "charge_ev_offpeak, delay_dryer, precool_ac, raise_ac_setpoint, "
                            "close_blinds, open_blinds, ac_off.",
                        },
                        "action": {"type": "string", "description": "Short imperative shown to the user."},
                        "reason": {"type": "string", "description": "One line on why now."},
                        "est_savings_c": {"type": "number", "description": "Estimated cents saved."},
                        "credit_reward": {"type": "integer", "description": "Credits awarded if followed."},
                        "window_minutes": {"type": "integer", "description": "How long the opportunity lasts."},
                        "confidence": {"type": "number", "description": "0..1 confidence this helps."},
                    },
                    "required": [
                        "kind", "action", "reason", "est_savings_c",
                        "credit_reward", "window_minutes", "confidence",
                    ],
                },
            }
        },
        "required": ["recommendations"],
    },
}
