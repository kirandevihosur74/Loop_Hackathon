/**
 * Shared domain types. These model the agent loop (plan → act → observe → self-correct).
 * The item lifecycle (`ItemStatus`) is the spine — every recommendation is one of these states.
 */

export type GridState = "cheap" | "medium" | "expensive"; // maps green / amber / red
export type Confidence = "low" | "med" | "high";

export type ItemStatus =
  | "investigating" // agent is looking into it (streaming)
  | "recommended" // has a recommendation
  | "auto_acted" // agent did it itself (reversible) — user can veto
  | "awaiting_approval" // drafted, needs a human tap (irreversible / comfort)
  | "approved"
  | "withdrawn" // agent changed its mind (self-correction)
  | "expired"; // action window closed

export interface Nudge {
  id: string;
  title: string; // stakes-first: lead with the consequence
  detail: string; // the why / evidence
  status: ItemStatus;
  confidence: Confidence;
  savingsUsd?: number;
  credits?: number;
  windowEndsAt?: string; // ISO — for expiring nudges
  flow?: { label: string; value: string }[]; // evidence "flow strip" A → B → cost
}

export interface UsagePoint {
  t: string; // ISO timestamp
  watts: number;
  gridState: GridState;
}

export interface DayForecast {
  date: string; // ISO date (YYYY-MM-DD)
  predictedKwh: number;
  predictedCostUsd: number;
  gridState: GridState;
}

/** One point on the intraday electricity price curve (Home hero scrubber). */
export interface PricePoint {
  hour: number; // 0..24
  cents: number; // ¢/kWh
}

export interface AdviceItem {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  text: string;
  done: boolean;
  savingsUsd?: number;
}

export type ApplianceType = "ev" | "hvac" | "kitchen" | "laundry" | "electronics" | "other";

export interface Appliance {
  id: string;
  name: string;
  type: ApplianceType;
  kw: number;
  note?: string;
  photo?: string; // compressed data URL of the scanned photo (for the details view)
}

/**
 * Outcome of a photo/stub appliance scan.
 * - `identified: true` → `appliance` is the persisted device row; add it to the list.
 * - `identified: false` → the server replied but the model could not confidently
 *   identify the device; `suggestion` is its best-guess default config, meant to
 *   prefill the manual Add Appliance form (nothing was persisted).
 * A network / endpoint failure is NOT a ScanResult — it throws instead.
 */
export interface ScanResult {
  identified: boolean;
  appliance?: Appliance;
  suggestion?: Omit<Appliance, "id">;
  note?: string;
  source?: string; // inference | claude | hardware-match | fallback
  confidence?: number; // 0..1
}

export interface AgentCheck {
  id: string;
  label: string;
  finding: string;
  state: "checking" | "done";
}

export interface LedgerEntry {
  id: string;
  text: string;
  when: string; // ISO timestamp
  canReopen: boolean;
}

/* ---- Stats screen aggregate ---- */

/** One hour of usage, colored by the grid price that hour. */
export interface HourUsage {
  hour: number; // 0–23
  kwh: number;
  gridState: GridState;
}

/** Usage attributed to one appliance category, translated to dollars. */
export interface ApplianceUsage {
  name: string;
  type: ApplianceType;
  kwh: number;
  costUsd: number;
}

export interface SplitUsage {
  kwh: number;
  costUsd: number;
}

/** Everything the Stats screen renders for a given range. */
export interface StatsSummary {
  range: "day" | "week" | "month";
  /** Signature metric: % of power used during cheap / clean hours. */
  timingScorePct: number;
  totalKwh: number;
  totalCostUsd: number;
  /** Hourly usage colored by grid price — "when you used vs. when it was cheap". */
  hourly: HourUsage[];
  /** "Where your watts go" — usage by appliance. */
  byAppliance: ApplianceUsage[];
  /** Home vs Car split (two mini rings). */
  split: { home: SplitUsage; car: SplitUsage };
  /** Cumulative saved this month, with a neighbor benchmark. */
  savedThisMonthUsd: number;
  neighborsAvgUsd: number; // benchmark: typical neighbor spend for the range
  youSpendUsd: number; // what you spent for the range (vs neighbors)
}

/** Return shape of a single agent run (checklist + result, plus optional self-correction). */
export interface AgentRunResult {
  checks: AgentCheck[];
  result: Nudge;
  selfCorrected?: Nudge;
}
