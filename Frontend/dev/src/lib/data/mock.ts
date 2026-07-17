/*
 * ============================================================================
 * TODO(backend): replace this file with a Postgres-backed implementation.
 * ----------------------------------------------------------------------------
 * The UI imports ONLY from `@/lib/data` (see ./index.ts) and never from here
 * directly. To swap in the real database, reimplement each exported function in
 * ./index.ts against Postgres (via Next route handlers or server actions) — the
 * function signatures in ./index.ts are the contract; do not change them, and
 * no component needs to change. This mock provides realistic, self-consistent
 * data so every screen renders and demos correctly today.
 * ============================================================================
 */

import type {
  Appliance,
  AdviceItem,
  AgentRunResult,
  DayForecast,
  GridState,
  LedgerEntry,
  Nudge,
  StatsSummary,
  UsagePoint,
} from "@/lib/types";
import { HARDWARE_DEVICES, HARDWARE_SCAN_EXTRAS, toAppliance } from "./hardware";

/* ---------- helpers ---------- */

/** Small deterministic PRNG so charts are stable within a session (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Time-of-use grid state for a given hour (0–23). Peak 4–9pm, shoulder daytime. */
export function gridStateForHour(hour: number): GridState {
  if (hour >= 16 && hour < 21) return "expensive";
  if (hour >= 9 && hour < 16) return "medium";
  if (hour >= 21 && hour < 23) return "medium";
  return "cheap";
}

function priceCentsForState(state: GridState): number {
  switch (state) {
    case "cheap":
      return 11;
    case "medium":
      return 22;
    case "expensive":
      return 34;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ---------- live usage ---------- */

export async function getLiveUsage(): Promise<UsagePoint[]> {
  const now = new Date();
  const rng = seeded(1337);
  const points: UsagePoint[] = [];
  // last ~2h, one point per minute
  for (let i = 120; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60_000);
    const hour = t.getHours();
    // base load + a couple of appliance spikes + gentle noise
    const base = 480 + Math.sin(i / 9) * 120;
    const spike = i % 37 < 6 ? 900 : 0; // periodic appliance cycles
    const noise = (rng() - 0.5) * 140;
    const watts = Math.max(180, Math.round(base + spike + noise));
    points.push({ t: t.toISOString(), watts, gridState: gridStateForHour(hour) });
  }
  return delay(points);
}

/* ---------- current grid + nudge ---------- */

export async function getGridState(): Promise<{ state: GridState; priceCents: number }> {
  const state = gridStateForHour(new Date().getHours());
  return delay({ state, priceCents: priceCentsForState(state) });
}

export async function getCurrentNudge(): Promise<Nudge | null> {
  const hour = new Date().getHours();
  const grid = gridStateForHour(hour);

  // During peak, surface the highest-stakes shift. Otherwise a lighter, auto-acted item.
  if (grid === "expensive") {
    return delay<Nudge>({
      id: "nudge-ev-peak",
      title: "Charging your Tesla now costs $4.20 — wait till 11pm and it's $1.10.",
      detail:
        "You're in peak pricing (34¢/kWh) until 9pm. Your car is home at 38% and doesn't leave till 7:30am, so there's plenty of room to charge overnight when it's cheapest.",
      status: "recommended",
      confidence: "high",
      savingsUsd: 3.1,
      credits: 15,
      windowEndsAt: new Date(Date.now() + 42 * 60_000).toISOString(),
      flow: [
        { label: "Now", value: "34¢ peak" },
        { label: "11pm", value: "11¢ cheap" },
        { label: "You save", value: "$3.10" },
      ],
    });
  }

  return delay<Nudge>({
    id: "nudge-preheat",
    title: "Handled: pre-cooled the house before the 4pm peak so the AC coasts.",
    detail:
      "Grid is cheap right now and turns expensive at 4pm. I ran the AC 2° cooler for 20 min so it can idle through peak instead of fighting it — reversible if you're not comfortable.",
    status: "auto_acted",
    confidence: "med",
    savingsUsd: 1.4,
    credits: 8,
    flow: [
      { label: "Now", value: "11¢ cheap" },
      { label: "4pm", value: "34¢ peak" },
      { label: "Saved", value: "$1.40" },
    ],
  });
}

/* ---------- forecasts ---------- */

function buildForecast(base: Date, count: number, seed: number): DayForecast[] {
  const rng = seeded(seed);
  const out: DayForecast[] = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(base, i);
    const dow = d.getDay(); // 0 Sun … 6 Sat
    const r = rng();
    // Weekends + high-solar days trend cheaper/greener; midweek trends peakier.
    let state: GridState;
    if (dow === 0 || dow === 6) state = r > 0.35 ? "cheap" : "medium";
    else if (dow === 2 || dow === 3) state = r > 0.55 ? "expensive" : "medium";
    else state = r > 0.6 ? "medium" : r > 0.3 ? "cheap" : "expensive";

    const predictedKwh = Math.round((22 + rng() * 14) * 10) / 10;
    const rate = state === "cheap" ? 0.14 : state === "medium" ? 0.24 : 0.33;
    const predictedCostUsd = Math.round(predictedKwh * rate * 100) / 100;
    out.push({ date: isoDate(d), predictedKwh, predictedCostUsd, gridState: state });
  }
  return out;
}

export async function getWeekForecast(): Promise<DayForecast[]> {
  return delay(buildForecast(new Date(), 7, 42));
}

export async function getMonthForecast(): Promise<DayForecast[]> {
  // Start at the 1st of the current month, cover the whole month.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return delay(buildForecast(first, daysInMonth, 99));
}

/* ---------- per-day advice (in-memory mutable) ---------- */

const ADVICE_TEMPLATES: Omit<AdviceItem, "id" | "date">[] = [
  { text: "Run the dishwasher after 11pm — off-peak rates.", done: false, savingsUsd: 0.9 },
  { text: "Charge the EV overnight (start 11pm, done by 6am).", done: false, savingsUsd: 3.1 },
  { text: "Pre-cool the house 2° before the 4pm peak.", done: false, savingsUsd: 1.4 },
  { text: "Delay the laundry to the solar window (11am–2pm).", done: false, savingsUsd: 0.7 },
  { text: "Skip the oven at dinner — grid is red 4–9pm.", done: false, savingsUsd: 1.1 },
];

const adviceStore = new Map<string, AdviceItem[]>();

function adviceForDate(date: string): AdviceItem[] {
  const existing = adviceStore.get(date);
  if (existing) return existing;
  // Deterministic subset per date so it's stable across taps.
  const seed = date.split("-").reduce((acc, n) => acc + Number(n), 0);
  const rng = seeded(seed);
  const count = 2 + Math.floor(rng() * 3); // 2–4 items
  const items: AdviceItem[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = ADVICE_TEMPLATES[(seed + i) % ADVICE_TEMPLATES.length];
    items.push({ ...tpl, id: `${date}-${i}`, date });
  }
  adviceStore.set(date, items);
  return items;
}

export async function getAdviceForDate(date: string): Promise<AdviceItem[]> {
  return delay(adviceForDate(date).map((a) => ({ ...a })));
}

export async function toggleAdvice(id: string): Promise<void> {
  for (const items of adviceStore.values()) {
    const item = items.find((a) => a.id === id);
    if (item) {
      item.done = !item.done;
      return;
    }
  }
  // If the date was never fetched, derive it from the id prefix and hydrate.
  const date = id.slice(0, 10);
  const items = adviceForDate(date);
  const item = items.find((a) => a.id === id);
  if (item) item.done = !item.done;
}

/* ---------- stats ---------- */

export async function getStats(range: "day" | "week" | "month"): Promise<StatsSummary> {
  const rng = seeded(range === "day" ? 7 : range === "week" ? 70 : 700);
  const scale = range === "day" ? 1 : range === "week" ? 7 : 30;

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const grid = gridStateForHour(hour);
    // People use most power morning + evening; we over-index cheap hours on purpose.
    const shape =
      hour >= 6 && hour < 9
        ? 1.4
        : hour >= 17 && hour < 22
          ? 1.2
          : hour >= 22 || hour < 6
            ? 0.9
            : 0.7;
    const kwh = Math.round((0.4 + rng() * 0.9) * shape * scale * 10) / 10;
    return { hour, kwh, gridState: grid };
  });

  const totalKwh = Math.round(hourly.reduce((s, h) => s + h.kwh, 0) * 10) / 10;
  const cheapKwh = hourly
    .filter((h) => h.gridState === "cheap")
    .reduce((s, h) => s + h.kwh, 0);
  const timingScorePct = Math.round((cheapKwh / totalKwh) * 100);

  // "Where your watts go" — a real breakdown, weighted from the hardware
  // dataset's annual-kWh figures and scaled to this range's actual usage so the
  // bars sum to what was used. Top devices shown individually; the tail bundled.
  const AVG_RATE = 0.27; // blended time-of-use $/kWh
  const weightTotal = HARDWARE_DEVICES.reduce((s, d) => s + d.annualKwh, 0);
  const ranked = HARDWARE_DEVICES.map((d) => ({
    name: d.name,
    type: d.type,
    kwh: (totalKwh * d.annualKwh) / weightTotal,
  })).sort((a, b) => b.kwh - a.kwh);
  const TOP = 6;
  const restKwh = ranked.slice(TOP).reduce((s, a) => s + a.kwh, 0);
  const byAppliance = [
    ...ranked.slice(0, TOP),
    ...(restKwh > 0.05 ? [{ name: "Other devices", type: "other" as const, kwh: restKwh }] : []),
  ].map((a) => ({
    name: a.name,
    type: a.type,
    kwh: Math.round(a.kwh * 10) / 10,
    costUsd: Math.round(a.kwh * AVG_RATE * 100) / 100,
  }));

  const totalCostUsd = Math.round(totalKwh * AVG_RATE * 100) / 100;
  // Home vs vehicle split — an illustrative usage lens (not from the device set).
  const carKwh = Math.round(totalKwh * 0.32 * 10) / 10;
  const homeKwh = Math.round((totalKwh - carKwh) * 10) / 10;
  const carCost = Math.round(carKwh * AVG_RATE * 100) / 100;

  return delay({
    range,
    timingScorePct,
    totalKwh,
    totalCostUsd,
    hourly,
    byAppliance,
    split: {
      home: { kwh: homeKwh, costUsd: Math.round((totalCostUsd - carCost) * 100) / 100 },
      car: { kwh: carKwh, costUsd: carCost },
    },
    savedThisMonthUsd: Math.round(18.4 * (range === "day" ? 1 : range === "week" ? 4 : 1) * 100) / 100,
    neighborsAvgUsd: Math.round(totalCostUsd * 1.28 * 100) / 100,
    youSpendUsd: totalCostUsd,
  });
}

/* ---------- agent loop ---------- */

export async function runAgentCheck(): Promise<AgentRunResult> {
  const checks = [
    { id: "c1", label: "Spot price", finding: "34¢/kWh — high, peak till 9pm", state: "done" as const },
    { id: "c2", label: "Weather", finding: "Sunny till 3pm, then clouding over", state: "done" as const },
    { id: "c3", label: "Your Tesla", finding: "Home · 38% · leaves 7:30am", state: "done" as const },
    { id: "c4", label: "Rooftop solar", finding: "Producing 2.1kW — covers the house", state: "done" as const },
    { id: "c5", label: "Dishwasher", finding: "Loaded, not started", state: "done" as const },
  ];

  const result: Nudge = {
    id: "agent-result",
    title: "Hold EV charging till 11pm — saves $3.10 tonight.",
    detail:
      "Peak until 9pm and your car doesn't leave till morning, so overnight charging is both cheaper and greener.",
    status: "recommended",
    confidence: "high",
    savingsUsd: 3.1,
    credits: 15,
    flow: [
      { label: "Now", value: "34¢" },
      { label: "11pm", value: "11¢" },
      { label: "Save", value: "$3.10" },
    ],
  };

  // Self-correction (the hero beat): the agent revises an earlier recommendation as
  // new evidence arrives. Clouds rolled in early → solar won't cover the dishwasher,
  // so the confident "run it now on solar" call is downgraded.
  const selfCorrected: Nudge = {
    id: "agent-selfcorrect",
    title: "Changed my mind: don't run the dishwasher on solar now.",
    detail:
      "I said run it now to soak up rooftop solar (High confidence). But clouds arrived early and production just dropped to 0.6kW, so it'd pull from the peak grid instead. Better to wait till 11pm.",
    status: "withdrawn",
    confidence: "med",
    flow: [
      { label: "Was", value: "Run now · High" },
      { label: "Now", value: "Wait 11pm · Med" },
    ],
  };

  return delay({ checks, result, selfCorrected }, 120);
}

const ledger: LedgerEntry[] = [
  {
    id: "l1",
    text: "Pre-cooled the house before the 4pm peak (2° for 20 min).",
    when: new Date(Date.now() - 2 * 3600_000).toISOString(),
    canReopen: true,
  },
  {
    id: "l2",
    text: "Delayed the dryer to the 12pm solar window.",
    when: new Date(Date.now() - 6 * 3600_000).toISOString(),
    canReopen: true,
  },
  {
    id: "l3",
    text: "Held EV charging until off-peak (11pm).",
    when: new Date(Date.now() - 20 * 3600_000).toISOString(),
    canReopen: false,
  },
  {
    id: "l4",
    text: "Skipped a pool-pump cycle during peak pricing.",
    when: new Date(Date.now() - 26 * 3600_000).toISOString(),
    canReopen: true,
  },
];

export async function getLedger(): Promise<LedgerEntry[]> {
  return delay(ledger.map((l) => ({ ...l })));
}

/* ---------- appliances (in-memory mutable) ---------- */

// Seeded from the real hardware-analytics dataset (curated in ./hardware).
const appliances: Appliance[] = HARDWARE_DEVICES.map(toAppliance);

/** Rotating pool of devices a "scan" might detect (also from the dataset). */
const SCAN_POOL: Omit<Appliance, "id">[] = HARDWARE_SCAN_EXTRAS.map((d) => ({
  name: d.name,
  type: d.type,
  kw: d.kw,
  note: d.note,
}));
let scanIdx = 0;
let idCounter = 100;

export async function getAppliances(): Promise<Appliance[]> {
  return delay(appliances.map((a) => ({ ...a })));
}

export async function addAppliance(a: Omit<Appliance, "id">): Promise<Appliance> {
  const created: Appliance = { ...a, id: `a${idCounter++}` };
  appliances.push(created);
  return delay(created, 300);
}

/** Convenience for the "scan an appliance" flow — returns the next detected device. */
export async function scanAppliance(): Promise<Appliance> {
  const next = SCAN_POOL[scanIdx % SCAN_POOL.length];
  scanIdx++;
  return addAppliance(next);
}

export async function deleteAppliance(id: string): Promise<void> {
  const idx = appliances.findIndex((a) => a.id === id);
  if (idx >= 0) appliances.splice(idx, 1);
  await delay(null, 150);
}

/* ---------- bill import ---------- */

export async function importBill(file: File): Promise<{ summary: string }> {
  // Stub: a real impl would parse the PDF/image. We just acknowledge the upload.
  void file;
  return delay(
    {
      summary:
        "Read your June bill — you're on a time-of-use plan, peak 4–9pm at 34¢/kWh. Your baseline is ~28 kWh/day, and the EV is your biggest single load. I'll plan around the peak window from now on.",
    },
    900,
  );
}
