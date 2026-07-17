"""Send a nudge as an SMS through the Zero.xyz CLI (agent tool-access layer).

Zero has no REST SDK — integration is by shelling out to the `zero` CLI, which discovers
a capability and executes it, paying per call in USDC on Base. We pin a capability
(default: Spraay SMS, $0.02/call) and call it via `zero fetch`.

Two safety gates (both in config):
- `zero_enabled` — off by default; when off, delivery is a no-op the loop reports.
- `zero_dry_run` — on by default; builds the exact CLI command but does NOT execute/spend.

Setup once (free, anonymous managed wallet):
    npm install -g @zeroxyz/cli
    zero auth agent register --json
    zero wallet fund            # add a few $ of USDC on Base to actually send
Then set ZERO_ENABLED=true and ZERO_DRY_RUN=false and ZERO_TARGET_PHONE=+1....
"""

import json
import shutil
import subprocess

from ..config import get_settings


def available() -> tuple[bool, str]:
    """Is delivery wired up? (enabled + CLI present + a capability pinned)."""
    s = get_settings()
    if not s.zero_enabled:
        return False, "disabled"
    if shutil.which(s.zero_cli) is None:
        return False, "cli-not-installed"
    if not s.zero_sms_capability:
        return False, "no-capability"
    return True, "ok"


def deliver_sms(to: str, message: str) -> dict:
    """Deliver one SMS. Never raises — returns a status dict the loop can log."""
    s = get_settings()
    ok, reason = available()
    if not ok:
        return {"delivered": False, "reason": reason}

    to = to or s.zero_target_phone
    if not to:
        return {"delivered": False, "reason": "no-recipient"}

    body = json.dumps({s.zero_sms_to_field: to, s.zero_sms_body_field: message})
    cmd = [
        s.zero_cli, "fetch",
        "--capability", s.zero_sms_capability,
        "-X", "POST",
        "-d", body,
        "--max-pay", str(s.zero_max_pay),
        "--json",
    ]

    if s.zero_dry_run:
        return {"delivered": False, "dry_run": True, "reason": "dry-run", "to": to, "cmd": " ".join(cmd)}

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=s.zero_timeout)
    except Exception as exc:  # missing binary, timeout, etc.
        return {"delivered": False, "reason": f"exec-error:{type(exc).__name__}"}

    if proc.returncode != 0:
        return {"delivered": False, "reason": "nonzero-exit", "stderr": proc.stderr[-300:]}
    try:
        out = json.loads(proc.stdout)
    except ValueError:
        return {"delivered": False, "reason": "bad-json", "stdout": proc.stdout[-300:]}

    return {
        "delivered": bool(out.get("ok")),
        "to": to,
        "runId": out.get("runId"),
        "status": out.get("status"),
        "payment": out.get("payment"),
    }
