# Nexla data pipelines (sponsor integration)

The autonomous loop reads **one latest reading** per household: real-time electricity
price + weather/temperature. Nexla is our ingestion layer — **Express** builds each
pipeline from a plain-English prompt, and the **Agent CLI** activates and monitors it.

The loop reads the landed rows via `backend/app/ingest/nexla.py` (`read_latest`), which
hits `NEXLA_SINK_URL`. If Nexla is unreachable, the loop falls back to a direct
GridStatus/Open-Meteo fetch, then to the mock curve — so a demo never hard-fails.

## Pipelines to build

### 1. Real-time electricity price (US ISO — CAISO to start)
**Express prompt:**
> "Ingest CAISO real-time 5-minute LMP for the SP15 zone from GridStatus.io. Convert
> $/MWh to cents/kWh as `price_c_per_kwh`. Keep timestamp. Land the latest row as JSON."

Output nexset fields: `ts`, `price_c_per_kwh`.
Swap `caiso` → `pjm` / `ercot` for other regions (see `_ISO_DATASET` in `ingest/pricing.py`).

### 2. Weather / temperature
**Express prompt:**
> "Every 30 minutes, fetch Open-Meteo current temperature_2m and weather_code for
> latitude 37.77, longitude -122.42. Land as `temp_c`, `weather`."

Output nexset fields: `ts`, `temp_c`, `weather`.

### 3. (Optional) Utility-bill history
**Express prompt:**
> "Parse uploaded utility bill PDFs into monthly kWh usage and cost; land per billing period."

Used later for neighbor benchmarks / plan comparison (post-MVP).

## Contract the loop expects at `NEXLA_SINK_URL`

A GET returning the latest row (or an array; the loop takes the last element):

```json
{ "price_c_per_kwh": 12.4, "price_percentile": 0.22, "temp_c": 24.1, "weather": "clear" }
```

`price_percentile` is optional — if Nexla can compute a 24h rolling rank, include it;
otherwise the loop treats it as 0.5. (A later step can move percentile ranking into the loop.)

## Why Nexla here

- 700+ connectors — GridStatus, Open-Meteo, S3, Postgres — with no glue code.
- Prompt-to-pipeline (Express) means new data sources are minutes, not hours.
- Agent CLI is scriptable + `--dry-run` safe, so the whole ingest layer is reproducible
  and lives in version control (`nexla/setup.sh`).

## Live wiring (path B — implemented, keyless-to-run)

The loop is wired to a **real Nexla pipeline** today. Concrete resource ids + keys live in
`nexla/RESOURCES.local.md` (gitignored). Shape:

1. **Webhook source** (`source_type: nexla_rest`) — Nexla hands back an ingest URL + api_key.
2. **Feeder** `python -m app.ingest.nexla_feed` pulls the live CAISO reading and POSTs it to
   that URL. Nexla lands it in a **nexset** (dataset).
3. **Read-back** — `ingest/nexla.read_latest` exchanges the **service key → bearer token**
   (`POST {NEXLA_API_URL}/token`) and pulls the newest record from
   `GET /data_sets/{NEXLA_NEXSET_ID}/samples`. Data genuinely transits Nexla:
   `CAISO → Nexla nexset → loop`. `/health` reports `data_source: nexla+caiso-fallback`.

Env to activate: `NEXLA_SERVICE_KEY`, `NEXLA_NEXSET_ID`, `NEXLA_INGEST_URL` (see `.env.example`).
Org tier is **Express Free** — 1M records/day, no credits/billing required.

**CLI caveat:** on the current `dataops.nexla.io` API instance the `nexla-cli`
`login`/`activate`/`sample`/`connectors` subcommands 404 (CLI↔API version skew), so the
integration uses the **raw REST API** directly (proven working). The CLI still installs via
`npm i -g @nexla/nexla-cli`; the aspirational flags in `setup.sh` are unverified against this
instance.
