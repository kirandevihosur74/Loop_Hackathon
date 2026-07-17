#!/usr/bin/env bash
# Nexla ingest setup — reproducible, dry-run first. Requires a Nexla service key.
# Docs: https://nexla.com/agent-cli/  |  https://express.dev/
#
# Every mutating command runs with --dry-run first (validates against live API schemas,
# zero changes). Re-run without --dry-run to apply. Usage: ./setup.sh [apply]
#
# NOTE: subcommand/flag shapes below follow the documented CLI surface. Confirm exact
# flags with `nexla-cli <resource> --help` (and the bundled Claude Code skill) before apply.
set -euo pipefail

APPLY="${1:-dryrun}"
flag="--dry-run"
[ "$APPLY" = "apply" ] && flag=""

# 1. Install (≈9s) — pick one:
#   uv tool install nexla-cli   |   pipx install nexla-cli   |   npm install -g @nexla/nexla-cli
command -v nexla-cli >/dev/null || { echo "Install nexla-cli first (see comment above)"; exit 1; }

# 2. Auth (expects NEXLA_SERVICE_KEY in env)
: "${NEXLA_SERVICE_KEY:?set NEXLA_SERVICE_KEY}"
nexla-cli login --service-key "$NEXLA_SERVICE_KEY"

# 3. Sources — build from Express prompts (see pipelines.md).
#    Express turns the prompt into a source; the CLI activates/monitors it.
echo "==> Creating CAISO real-time price source ($flag)"
nexla-cli sources create $flag --output json \
  --name "caiso-rt-lmp" \
  --prompt "Ingest CAISO real-time 5-min LMP for SP15 from GridStatus.io; convert \$/MWh to cents/kWh as price_c_per_kwh; keep ts; land latest row as JSON."

echo "==> Creating Open-Meteo weather source ($flag)"
nexla-cli sources create $flag --output json \
  --name "open-meteo-weather" \
  --prompt "Every 30 min fetch Open-Meteo current temperature_2m and weather_code for lat 37.77 lon -122.42; land as temp_c, weather."

# 4. Sink — where the loop reads from (NEXLA_SINK_URL). Webhook/HTTP or a small store.
echo "==> Creating sink ($flag)"
nexla-cli sinks create $flag --output json \
  --name "loop-latest-reading" \
  --type webhook   # point NEXLA_SINK_URL at this sink's read endpoint

# 5. Flows — connect sources -> sink (join price + weather into one reading).
echo "==> Wiring flow ($flag)"
nexla-cli flows create $flag --output json \
  --name "home-energy-reading" \
  --sources "caiso-rt-lmp,open-meteo-weather" \
  --sink "loop-latest-reading"

# 6. Activate + verify
if [ "$APPLY" = "apply" ]; then
  nexla-cli flows activate --name "home-energy-reading"
  nexla-cli flows get --name "home-energy-reading" --output json
  echo "Set backend/.env: USE_MOCK_DATA=false and NEXLA_SINK_URL=<sink read url>"
fi
