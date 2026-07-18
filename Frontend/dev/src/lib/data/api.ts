/**
 * Real backend implementations of the data-layer contract (FastAPI loop backend).
 *
 * Maps the backend's wire shapes onto the UI domain types. Every function throws on
 * network/HTTP failure — `index.ts` catches and falls back to the mock, so the app
 * keeps rendering when the server is down.
 *
 * Backend: see repo /backend (FastAPI). Base URL via NEXT_PUBLIC_API_BASE
 * (default http://localhost:8000). The demo household is id 1 (seeded).
 */

import type {
  AgentCheck,
  AgentRunResult,
  Appliance,
  ApplianceType,
  Confidence,
  GridState,
  LedgerEntry,
  Nudge,
  ScanResult,
} from "@/lib/types";
import { getApiBase, pushApiLog, summarizeBody } from "@/lib/devLog";

const HOUSEHOLD = 1;

async function api<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 4000, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const started = performance.now();
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      ...rest,
      headers: { "content-type": "application/json", ...(rest.headers ?? {}) },
    });
    const durationMs = Math.round(performance.now() - started);
    if (!res.ok) {
      pushApiLog({
        method,
        path,
        status: res.status,
        ok: false,
        durationMs,
        source: "error",
        error: `HTTP ${res.status}`,
      });
      throw new Error(`${path} -> HTTP ${res.status}`);
    }
    const data = (await res.json()) as T;
    pushApiLog({
      method,
      path,
      status: res.status,
      ok: true,
      durationMs,
      source: "live",
      summary: summarizeBody(data),
    });
    return data;
  } catch (err) {
    const durationMs = Math.round(performance.now() - started);
    // Avoid double-logging HTTP errors already recorded above.
    if (!(err instanceof Error && /HTTP \d+/.test(err.message))) {
      pushApiLog({
        method,
        path,
        ok: false,
        durationMs,
        source: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

/* ---------- wire shapes (backend) ---------- */

interface WireNudge {
  id: number;
  kind: string;
  action: string;
  reason: string;
  est_savings_c: number;
  credit_reward: number;
  window_end?: string | null;
  confidence: number;
  status: "active" | "followed" | "dismissed" | "expired";
}

interface WireLoopRun {
  model_used: string;
  snapshot: { price_c_per_kwh: number; price_percentile: number; temp_c: number; source: string };
  suppressed_kinds: string[];
  nudges_created: WireNudge[];
}

/* ---------- mappers ---------- */

const confBand = (c: number): Confidence => (c >= 0.75 ? "high" : c >= 0.5 ? "med" : "low");

const NUDGE_STATUS: Record<WireNudge["status"], Nudge["status"]> = {
  active: "recommended",
  followed: "approved",
  dismissed: "withdrawn",
  expired: "expired",
};

function toNudge(w: WireNudge): Nudge {
  const savingsUsd = Math.round(w.est_savings_c) / 100;
  return {
    id: String(w.id),
    title: w.action,
    detail: w.reason,
    status: NUDGE_STATUS[w.status] ?? "recommended",
    confidence: confBand(w.confidence),
    savingsUsd,
    credits: w.credit_reward,
    windowEndsAt: w.window_end ?? undefined,
    flow: [
      { label: "Save", value: `$${savingsUsd.toFixed(2)}` },
      { label: "Credits", value: `+${w.credit_reward}` },
    ],
  };
}

// backend appliance type slug -> UI category (and back, for writes)
const TYPE_TO_UI: Record<string, ApplianceType> = {
  ev_charger: "ev",
  ac: "hvac",
  dishwasher: "kitchen",
  washer: "laundry",
  dryer: "laundry",
  kitchen: "kitchen",
  electronics: "electronics",
  other: "other",
};
const UI_TO_TYPE: Partial<Record<ApplianceType, string>> = {
  ev: "ev_charger",
  hvac: "ac",
  kitchen: "dishwasher",
  laundry: "washer",
  electronics: "electronics",
  other: "other",
};

interface WireAppliance {
  id: number;
  type: string;
  model: string;
  power_kw: number;
  note?: string;
}

/**
 * Wire shape of POST /household/{id}/appliances/scan (see backend/app/api/routers/household.py).
 * `id` is null when the model couldn't identify the device (nothing persisted);
 * `identified` is explicit on newer backends, and derivable from `source` on older ones.
 */
interface WireScanResponse {
  id: number | null;
  type: string;
  model: string;
  power_kw: number;
  flexible?: boolean;
  household_id?: number;
  note?: string;
  source?: string; // inference | claude | hardware-match | fallback
  confidence?: number;
  identified?: boolean;
}

function toAppliance(w: WireAppliance): Appliance {
  return {
    id: String(w.id),
    name: w.model || w.type,
    type: TYPE_TO_UI[w.type] ?? (w.type as ApplianceType) ?? "other",
    kw: w.power_kw,
    note: w.note,
  };
}

/* ---------- contract implementations ---------- */

export async function getGridState(): Promise<{ state: GridState; priceCents: number }> {
  const g = await api<{ state: GridState; price_cents: number }>(
    `/grid/state?household_id=${HOUSEHOLD}`,
    { timeoutMs: 8000 }, // live CAISO/Nexla fetch behind it
  );
  return { state: g.state, priceCents: Math.round(g.price_cents * 10) / 10 };
}

export async function getCurrentNudge(): Promise<Nudge | null> {
  const active = await api<WireNudge[]>(`/nudges/active?household_id=${HOUSEHOLD}`);
  return active.length ? toNudge(active[0]) : null; // backend orders by est. savings desc
}

export async function runAgentCheck(): Promise<AgentRunResult> {
  const run = await api<WireLoopRun>(`/loop/run?household_id=${HOUSEHOLD}`, {
    method: "POST",
    body: JSON.stringify({}),
    timeoutMs: 120000, // real cycle: live ingest + Claude planning via gateway (can run ~40-60s)
  });

  const s = run.snapshot;
  const pctile = Math.round(s.price_percentile * 100);
  const checks: AgentCheck[] = [
    {
      id: "price",
      label: "Spot price",
      finding: `${s.price_c_per_kwh.toFixed(1)}¢/kWh — cheaper than ${100 - pctile}% of today`,
      state: "done",
    },
    {
      id: "weather",
      label: "Weather",
      finding: `${Math.round(s.temp_c)}°C · data via ${s.source}`,
      state: "done",
    },
    {
      id: "patterns",
      label: "Your patterns",
      finding: run.suppressed_kinds.length
        ? `Muted: ${run.suppressed_kinds.join(", ")} (you kept skipping these)`
        : "Learning from your responses",
      state: "done",
    },
    {
      id: "brain",
      label: "Agent brain",
      finding: run.model_used.startsWith("mock") ? "Rule engine (offline mode)" : run.model_used,
      state: "done",
    },
  ];

  let result: Nudge;
  if (run.nudges_created.length) {
    result = toNudge(run.nudges_created[0]);
  } else {
    const active = await api<WireNudge[]>(`/nudges/active?household_id=${HOUSEHOLD}`);
    result = active.length
      ? toNudge(active[0])
      : {
          id: "agent-quiet",
          title: "All clear — nothing worth changing right now.",
          detail: "The agent checked prices, weather and your appliances; no move beats doing nothing.",
          status: "recommended",
          confidence: "high",
        };
  }

  const selfCorrected: Nudge | undefined = run.suppressed_kinds.length
    ? {
        id: "self-corrected",
        title: `Stopped suggesting: ${run.suppressed_kinds.join(", ").replace(/_/g, " ")}`,
        detail: "You dismissed this kind repeatedly, so the agent withdrew it from rotation.",
        status: "withdrawn",
        confidence: "high",
      }
    : undefined;

  return { checks, result, selfCorrected };
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const events = await api<{ id: number; reason: string; ts: string }[]>(
    `/credits/events?household_id=${HOUSEHOLD}&since_id=0`,
  );
  return events
    .slice()
    .reverse()
    .map((e) => ({ id: String(e.id), text: e.reason, when: e.ts, canReopen: false }));
}

export async function getAppliances(): Promise<Appliance[]> {
  const rows = await api<WireAppliance[]>(`/household/${HOUSEHOLD}/appliances`);
  return rows.map(toAppliance);
}

export async function addAppliance(a: Omit<Appliance, "id">): Promise<Appliance> {
  const row = await api<WireAppliance>(`/household/${HOUSEHOLD}/appliances`, {
    method: "POST",
    body: JSON.stringify({
      type: UI_TO_TYPE[a.type] ?? a.type,
      model: a.name,
      power_kw: a.kw,
      flexible: true,
    }),
  });
  return toAppliance(row);
}

export async function deleteAppliance(id: string): Promise<void> {
  await api(`/household/${HOUSEHOLD}/appliances/${id}`, { method: "DELETE" });
}

/** Devices a stub "Scan appliance" (no photo) can detect — rotates and POSTs via addAppliance. */
const SCAN_POOL: Omit<Appliance, "id">[] = [
  { name: "Nest Thermostat", type: "hvac", kw: 0.005 },
  { name: "Samsung Fridge", type: "kitchen", kw: 0.15 },
  { name: "PS5", type: "electronics", kw: 0.2 },
  { name: "Rivian R1T", type: "ev", kw: 11.5 },
  { name: "Miele Oven", type: "kitchen", kw: 3.6 },
];
let scanIdx = 0;

/**
 * Detect an appliance.
 * - With a photo: POST multipart to `/appliances/scan` (inference → persisted row).
 *   Resolves with `identified: false` + a prefill `suggestion` when the model
 *   couldn't identify the device; THROWS only on network / endpoint failure.
 * - Without: rotate SCAN_POOL and POST via addAppliance (survives reload).
 */
export async function scanAppliance(file?: File): Promise<ScanResult> {
  if (file) {
    const path = `/household/${HOUSEHOLD}/appliances/scan`;
    const form = new FormData();
    form.append("file", file);
    const started = performance.now();

    try {
      const res = await fetch(`${getApiBase()}${path}`, {
        method: "POST",
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      });
      const durationMs = Math.round(performance.now() - started);
      if (!res.ok) {
        pushApiLog({
          method: "POST",
          path,
          status: res.status,
          ok: false,
          durationMs,
          source: "error",
          error: `HTTP ${res.status}`,
        });
        throw new Error(`${path} -> HTTP ${res.status}`);
      }
      const row = (await res.json()) as WireScanResponse;
      // A 200 that isn't a device config (e.g. a proxy answering for the
      // backend) counts as an endpoint failure, not a scan verdict.
      if (!row || typeof row !== "object" || typeof row.power_kw !== "number" || !row.type) {
        throw new Error(`${path} -> unexpected response shape`);
      }
      pushApiLog({
        method: "POST",
        path,
        status: res.status,
        ok: true,
        durationMs,
        source: "live",
        summary: summarizeBody(row),
      });

      const identified =
        row.identified ?? (row.source ? row.source !== "fallback" : row.id != null);
      const mapped = toAppliance({
        id: row.id ?? 0,
        type: row.type,
        model: row.model,
        power_kw: row.power_kw,
        note: row.note,
      });
      if (identified && row.id != null) {
        return {
          identified: true,
          appliance: mapped,
          note: row.note,
          source: row.source,
          confidence: row.confidence,
        };
      }
      return {
        identified: false,
        suggestion: { name: mapped.name, type: mapped.type, kw: mapped.kw, note: mapped.note },
        note: row.note,
        source: row.source,
        confidence: row.confidence,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - started);
      if (!(err instanceof Error && /HTTP \d+/.test(err.message))) {
        pushApiLog({
          method: "POST",
          path,
          ok: false,
          durationMs,
          source: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }

  const pick = SCAN_POOL[scanIdx++ % SCAN_POOL.length];
  return { identified: true, appliance: await addAppliance(pick) };
}
