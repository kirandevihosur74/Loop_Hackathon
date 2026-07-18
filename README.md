# Loop — "Fitness Tracker for Your House" ⚡

A gamified, AI-driven system that cuts household electricity bills with timely **nudges**
(*"Electricity is 50% cheaper now — run the dishwasher."*). The engine is an **autonomous
agentic loop** that runs on a cadence and continuously **plans → acts → observes → self-corrects**.

This repo holds the **autonomous loop + data ingestion** (the agent brain). Teammates own
the mobile-web frontend, gamification (mascot/leaderboards/hearts), and the credit system —
they integrate against the contract endpoints below.

---

## How it works

- **Watches the real world** — pulls the live California grid price (CAISO via Nexla), weather, and even whether the sun is hitting your windows (SF building-shadow map).
- **Thinks with Claude** — every cycle, the agent looks at your appliances and the current price and decides the *one thing* worth telling you right now.
- **Nudges you** — *"Electricity is at its cheapest 5% today — run the dishwasher, save $0.78."* Follow it, earn credits toward your bill.
- **Learns from you** — ignore a type of nudge three times and the agent stops suggesting it. Nobody coded that rule; the loop corrects itself.
- **Runs on a heartbeat** — a background cycle (plan → act → observe → self-correct) every ~60 min, plus a "run a check now" button in the app.

---

## Sponsors

- **Nexla** — our data ingestion layer. Live grid readings flow through a real Nexla pipeline (webhook source → nexset), and the agent reads its world-state back out of Nexla's API every cycle.
- **Akash** — our cloud. The backend runs as a container on Akash's decentralized compute marketplace (~$5/month) instead of AWS, deployed from a public image with one manifest.
- **Zero.xyz** — the agent's hands. When a nudge is worth sending as a text message, the agent uses Zero's tool network to discover and call an SMS service, paying per call in USDC — no API keys, no Twilio account.

---

## Agent Loop

`LoopEngine.run_cycle()` → `backend/app/loop/engine.py`

| Stage | File | What it does |
|-------|------|--------------|
| **OBSERVE** | `loop/stages/observe.py` | Pull a reading (price + percentile, temp, weather), store a `Snapshot`, assemble context |
| **REFLECT** | `loop/stages/reflect.py` | Score last cycle's nudges, learn `UserPattern` responsiveness, **suppress ignored kinds** |
| **PLAN** | `agent/client.py` | Claude (structured tool output) → ranked recommendations. Mock brain if no API key |
| **ACT** | `loop/stages/act.py` | Dedupe + fatigue filter → persist `Nudge`s, emit push/credit events |

**Self-correction** = REFLECT suppresses any nudge kind the user keeps dismissing, so the
loop visibly adapts. (Proven in `tests/test_flow.py::test_loop_self_corrects...`.)

- **Brain:** Claude API direct — Haiku (cheap, high-cadence) by default, Sonnet for heavier analysis. Runs **keyless** via a rule-based mock brain for demos.
- **Data (real by default, keyless):** live **CAISO OASIS** real-time 5-min LMP → `ingest/caiso.py` (the ground truth behind CAISO's *Today's Outlook › Prices*), + Open-Meteo weather. The price **percentile is computed from today's actual price distribution**, not a model.
  Ingest order: Nexla sink → **CAISO OASIS** → GridStatus → mock. Set `USE_MOCK_DATA=true` for an offline/deterministic demo. See [`nexla/`](nexla/).
- **Cadence:** APScheduler (default 60 min, `ENABLE_SCHEDULER`) + manual `POST /loop/run` for demos.

---

## Quickstart

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -e .   # or: pip install -r deps in pyproject
cp .env.example .env                                   # optional — runs keyless without it
PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs
```

---

## API contracts

| Method & path | Purpose |
|---|---|
| `POST /loop/run?household_id=1` | Run one cycle now. Body `{"force_price_percentile": 0.05}` pins price for demos |
| `GET /loop/status?household_id=1` | Recent loop runs + metrics |
| `GET /nudges/active?household_id=1` | Active nudges for the Duolingo-style UI |
| `POST /nudges/{id}/outcome` | `{"followed": true|false}` → feeds REFLECT + awards credits |
| `GET /credits/events?household_id=1&since_id=0` | Credit-award events (their credit system consumes) |
| `GET /credits/balance?household_id=1` | Running credit balance |
| `GET/POST /household/{id}` + `/appliances` | Onboarding profile + appliances |
| `POST /household/{id}/appliances/scan` | Multipart photo → identify + add appliance |
| `GET /health` | Which brain / data source is live |

---

## Data model

`Household · Appliance · Snapshot · Nudge · Outcome · UserPattern · CreditEvent · LoopRun`
→ `backend/app/data/models.py`. SQLite by default (`DATABASE_URL`).

## Tests

```bash
cd backend && PYTHONPATH=. .venv/bin/python -m pytest -q
```
