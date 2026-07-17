/**
 * The data-layer contract — the ONLY module UI code imports for domain data.
 *
 * Components import from `@/lib/data` and nowhere else. Today these delegate to
 * the in-memory mock (./mock). The backend team reimplements each function
 * against Postgres (route handlers or server actions) WITHOUT changing these
 * signatures — no component will need to change.
 *
 * Rule: never import a DB client in a component. Everything flows through here.
 */

import type {
  AdviceItem,
  AgentRunResult,
  Appliance,
  DayForecast,
  GridState,
  LedgerEntry,
  Nudge,
  StatsSummary,
  UsagePoint,
} from "@/lib/types";
import * as mock from "./mock";

/** Live household usage — last ~2h, ~one point per minute. */
export async function getLiveUsage(): Promise<UsagePoint[]> {
  return mock.getLiveUsage();
}

/** The single nudge to surface on Home right now (or null if nothing to act on). */
export async function getCurrentNudge(): Promise<Nudge | null> {
  return mock.getCurrentNudge();
}

/** Current grid price state + rate in cents/kWh. */
export async function getGridState(): Promise<{ state: GridState; priceCents: number }> {
  return mock.getGridState();
}

/** 7-day forward forecast (one entry per day). */
export async function getWeekForecast(): Promise<DayForecast[]> {
  return mock.getWeekForecast();
}

/** Whole-month forward forecast (one entry per day). */
export async function getMonthForecast(): Promise<DayForecast[]> {
  return mock.getMonthForecast();
}

/** The agent's recommended checklist for a given ISO date (YYYY-MM-DD). */
export async function getAdviceForDate(date: string): Promise<AdviceItem[]> {
  return mock.getAdviceForDate(date);
}

/** Toggle a single advice item's done state. */
export async function toggleAdvice(id: string): Promise<void> {
  return mock.toggleAdvice(id);
}

/** Aggregated stats for a range (day / week / month). */
export async function getStats(range: "day" | "week" | "month"): Promise<StatsSummary> {
  return mock.getStats(range);
}

/** Run one agent check — returns the streamed checklist, a result, and an optional self-correction. */
export async function runAgentCheck(): Promise<AgentRunResult> {
  return mock.runAgentCheck();
}

/** The trust ledger — actions the agent took on its own. */
export async function getLedger(): Promise<LedgerEntry[]> {
  return mock.getLedger();
}

/** All registered appliances. */
export async function getAppliances(): Promise<Appliance[]> {
  return mock.getAppliances();
}

/** Add an appliance (manual entry). */
export async function addAppliance(a: Omit<Appliance, "id">): Promise<Appliance> {
  return mock.addAppliance(a);
}

/** Simulate a camera/QR scan that detects and adds an appliance. */
export async function scanAppliance(): Promise<Appliance> {
  return mock.scanAppliance();
}

/** Remove an appliance by id. */
export async function deleteAppliance(id: string): Promise<void> {
  return mock.deleteAppliance(id);
}

/** Import an electricity bill (PDF/image). Stub returns a canned summary. */
export async function importBill(file: File): Promise<{ summary: string }> {
  return mock.importBill(file);
}
