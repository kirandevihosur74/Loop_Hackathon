/**
 * Live API request log + runtime API base override for developer settings.
 * Kept tiny and client-only so the My Home debug panel can stream traffic.
 */

export type ApiLogSource = "live" | "mock-fallback" | "error";

export type ApiLogEntry = {
  id: string;
  ts: number;
  method: string;
  path: string;
  status?: number;
  ok: boolean;
  durationMs: number;
  source: ApiLogSource;
  summary?: string;
  error?: string;
};

const API_BASE_KEY = "powerfly.apiBase";
const STRICT_KEY = "powerfly.strictLive";
const LOGS_KEY = "powerfly.apiLogs";
const MAX_LOGS = 80;

type Listener = () => void;

/** Hydrate the buffer from localStorage so logs captured before the dev panel
 * was ever opened (and across reloads) are still there to inspect. */
function loadPersisted(): ApiLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as ApiLogEntry[]).slice(0, MAX_LOGS) : [];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    /* quota / private mode — logging is best-effort */
  }
}

let logs: ApiLogEntry[] = loadPersisted();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeApiLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLogs(): ApiLogEntry[] {
  return logs;
}

export function clearApiLogs() {
  logs = [];
  persist();
  notify();
}

export function pushApiLog(entry: Omit<ApiLogEntry, "id" | "ts"> & { id?: string; ts?: number }) {
  const row: ApiLogEntry = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: entry.ts ?? Date.now(),
    ...entry,
  };
  logs = [row, ...logs].slice(0, MAX_LOGS);
  persist();
  notify();
  if (typeof console !== "undefined") {
    const tag = row.ok ? "✓" : "✗";
    console.info(
      `[api ${tag}] ${row.method} ${row.path} ${row.status ?? "—"} ${row.durationMs}ms (${row.source})`,
      row.summary ?? row.error ?? "",
    );
  }
}

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(API_BASE_KEY)?.trim();
      if (override) return override.replace(/\/+$/, "");
    } catch {
      /* private mode */
    }
  }
  return (process.env.NEXT_PUBLIC_API_BASE ?? "https://inference.josephbissell.com/hax").replace(
    /\/+$/,
    "",
  );
}

export function setApiBase(url: string) {
  if (typeof window === "undefined") return;
  const cleaned = url.trim().replace(/\/+$/, "");
  if (cleaned) window.localStorage.setItem(API_BASE_KEY, cleaned);
  else window.localStorage.removeItem(API_BASE_KEY);
  notify();
}

/** When true, photo scan / writes never silently fall back to mock. */
export function getStrictLive(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(STRICT_KEY);
    if (v === null) return true; // default on — surface API failures
    return v === "1";
  } catch {
    return true;
  }
}

export function setStrictLive(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STRICT_KEY, on ? "1" : "0");
  notify();
}

export function summarizeBody(data: unknown, max = 160): string {
  try {
    const s = typeof data === "string" ? data : JSON.stringify(data);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(data);
  }
}
