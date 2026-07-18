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
import { getApiBase, getInferenceKey, pushApiLog, summarizeBody } from "@/lib/devLog";

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
 * Photo appliance ID runs on the inference bridge (/hax) — an Anthropic
 * Messages API endpoint (vision, no tools). We send the image + instructions
 * and the model replies with a JSON device config we parse below.
 */
const SCAN_MODEL = "claude-haiku-4-5-20251001";
const SCAN_SYSTEM =
  `You identify home electrical appliances for an energy app. Look at the photo and respond with ONLY a ` +
  `JSON object (no markdown, no prose): {"identified":boolean,"type":one of ` +
  `[ev_charger,ac,dishwasher,washer,dryer,kitchen,electronics,other],"model":string,` +
  `"power_kw":number,"flexible":boolean,"confidence":number,"note":string}. power_kw = typical running ` +
  `power in kW. If no appliance is clearly visible set identified=false and give a best-guess generic row.`;

interface ScanJson {
  identified?: boolean;
  type: string;
  model?: string;
  power_kw: number;
  flexible?: boolean;
  confidence?: number;
  note?: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

/** Pull the JSON object out of the model's reply (tolerates ```json fences / prose). */
function parseScanJson(text: string): ScanJson | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as ScanJson;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

/**
 * Shrink a captured photo to a small JPEG (data URL) so it's cheap to keep and
 * quick to show in the device-details view. Returns "" if it can't be encoded.
 */
async function compressPhoto(dataUrl: string, maxDim = 800, quality = 0.7): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}

const REFINE_SYSTEM =
  `You are refining an UNCERTAIN home-appliance identification for an energy app. Study the photo ` +
  `closely — read any visible brand, model number, wattage or nameplate text, and use your knowledge ` +
  `of that specific device/category. Respond with ONLY a JSON object (no markdown): ` +
  `{"type":one of [ev_charger,ac,dishwasher,washer,dryer,kitchen,electronics,other],"model":string,` +
  `"power_kw":number,"confidence":number,"note":short}. power_kw = typical RUNNING power in kW.`;

/** One vision call to the /hax bridge. Logs to the dev panel, throws on transport
 *  failure, returns the parsed JSON (or null if the reply carried no JSON). */
async function askVision(
  dataUrl: string,
  system: string,
  userText: string,
  label: string,
): Promise<ScanJson | null> {
  const path = "/v1/messages";
  const key = getInferenceKey();
  const comma = dataUrl.indexOf(",");
  const media = /^data:([^;]+)/.exec(dataUrl)?.[1] || "image/jpeg";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const started = performance.now();
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(key ? { "x-api-key": key } : {}),
      },
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 500,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: media, data: b64 } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });
    const durationMs = Math.round(performance.now() - started);
    if (!res.ok) {
      pushApiLog({ method: "POST", path: label, status: res.status, ok: false, durationMs, source: "error", error: `HTTP ${res.status}` });
      throw new Error(`${path} -> HTTP ${res.status}`);
    }
    const msg = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const out = (msg.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    const parsed = parseScanJson(out);
    pushApiLog({ method: "POST", path: label, status: res.status, ok: true, durationMs, source: "live", summary: summarizeBody(parsed ?? out.slice(0, 80)) });
    return parsed;
  } catch (err) {
    const durationMs = Math.round(performance.now() - started);
    if (!(err instanceof Error && /HTTP \d+/.test(err.message))) {
      pushApiLog({ method: "POST", path: label, ok: false, durationMs, source: "error", error: err instanceof Error ? err.message : String(err) });
    }
    throw err;
  }
}

/**
 * Agent loop for an uncertain device: re-examine the stored photo with a more
 * careful prompt (up to 2 passes) to pin the model and typical kW. Returns the
 * fields to patch onto the device; never throws — on failure it just clears the
 * researching flag and leaves the original approximation in place.
 */
export async function refineAppliance(app: Appliance): Promise<Partial<Appliance>> {
  if (!app.photo) return { researching: false };
  try {
    let best: ScanJson | null = null;
    for (let pass = 0; pass < 2; pass++) {
      const userText =
        pass === 0
          ? "Re-examine this appliance carefully and identify it as precisely as you can."
          : `Your previous read was "${best?.model ?? "unknown"}" (~${best?.power_kw ?? "?"} kW). ` +
            "Double-check the exact device and its typical running kW, and correct anything that's off.";
      const r = await askVision(app.photo, REFINE_SYSTEM, userText, "/v1/messages refine");
      if (r && typeof r.power_kw === "number" && r.type) {
        if (!best || (r.confidence ?? 0) >= (best.confidence ?? 0)) best = r;
        if ((r.confidence ?? 0) >= 0.8) break;
      }
    }
    if (!best) return { researching: false };
    const confident = (best.confidence ?? 0) >= 0.7;
    return {
      name: best.model || app.name,
      type: TYPE_TO_UI[best.type] ?? "other",
      kw: best.power_kw,
      note: best.note || app.note,
      approximate: !confident,
      researching: false,
    };
  } catch {
    return { researching: false };
  }
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
 * - With a photo: send it to the /hax inference bridge (Anthropic Messages API,
 *   vision) and parse the JSON device config from the reply. Resolves with
 *   `identified: false` + a prefill `suggestion` when the model couldn't identify
 *   the device; THROWS only on network / endpoint failure.
 * - Without: rotate SCAN_POOL and POST via addAppliance (survives reload).
 */
export async function scanAppliance(file?: File): Promise<ScanResult> {
  if (file) {
    const dataUrl = await fileToDataUrl(file);
    // Compressed copy kept with the device for the details view + refine loop.
    const photo = (await compressPhoto(dataUrl)) || undefined;
    const parsed = await askVision(dataUrl, SCAN_SYSTEM, "Identify this appliance.", "/v1/messages scan");
    // A 200 that isn't a device config (e.g. a bare proxy answer) is an endpoint
    // failure, not a scan verdict.
    if (!parsed || typeof parsed.power_kw !== "number" || !parsed.type) {
      throw new Error("/v1/messages -> unparseable scan response");
    }

    const conf = typeof parsed.confidence === "number" ? parsed.confidence : undefined;
    // Unsure = the model said so, or it's not confident enough. Either way we
    // still add the device (best-guess) and let the refine loop improve it.
    const approximate = parsed.identified === false || (conf !== undefined && conf < 0.7);
    const mapped = toAppliance({
      id: 0,
      type: parsed.type,
      model: parsed.model ?? "",
      power_kw: parsed.power_kw,
      note: parsed.note,
    });
    const appliance: Appliance = {
      ...mapped,
      id: `scan-${Date.now().toString(36)}`,
      photo,
      approximate,
      researching: approximate,
    };
    return {
      identified: parsed.identified !== false,
      appliance,
      approximate,
      note: parsed.note,
      source: "claude",
      confidence: conf,
    };
  }

  const pick = SCAN_POOL[scanIdx++ % SCAN_POOL.length];
  return { identified: true, appliance: await addAppliance(pick), approximate: false };
}
