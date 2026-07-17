"use client";

import { useEffect, useRef, useState } from "react";
import { GhostButton, PrimaryButton } from "@/components/ui";
import {
  clearApiLogs,
  getApiBase,
  getApiLogs,
  getStrictLive,
  setApiBase,
  setStrictLive,
  subscribeApiLog,
  type ApiLogEntry,
} from "@/lib/devLog";

const TAPS_TO_UNLOCK = 5;
const TAP_WINDOW_MS = 2500;

/**
 * Hidden developer entry: tap the footer label 5 times quickly to open
 * live API logging + base URL controls.
 */
export function DeveloperSettings() {
  const [open, setOpen] = useState(false);
  const [taps, setTaps] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSecretTap() {
    if (open) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    const next = taps + 1;
    if (next >= TAPS_TO_UNLOCK) {
      setTaps(0);
      setOpen(true);
      return;
    }
    setTaps(next);
    resetTimer.current = setTimeout(() => setTaps(0), TAP_WINDOW_MS);
  }

  return (
    <div className="mt-8 border-t border-line pt-4">
      <button
        type="button"
        onClick={handleSecretTap}
        className="mx-auto block w-full select-none py-3 text-center text-[11px] tracking-wide text-sub/70"
        aria-label={
          open
            ? "Developer settings open"
            : `Version label — tap ${TAPS_TO_UNLOCK} times for developer settings`
        }
      >
        Powerfly · local build
        {taps > 0 && !open ? (
          <span className="ml-1 tabular-nums text-sub/50">
            ({taps}/{TAPS_TO_UNLOCK})
          </span>
        ) : null}
      </button>

      {open ? <DeveloperPanel onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function DeveloperPanel({ onClose }: { onClose: () => void }) {
  const [base, setBase] = useState(getApiBase);
  const [strict, setStrict] = useState(getStrictLive);
  const [logs, setLogs] = useState<ApiLogEntry[]>(() => getApiLogs());
  const [ping, setPing] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    return subscribeApiLog(() => {
      setLogs(getApiLogs());
      setBase(getApiBase());
      setStrict(getStrictLive());
    });
  }, []);

  function saveBase() {
    setApiBase(base);
    setPing(`Saved API base → ${getApiBase()}`);
  }

  async function runHealthPing() {
    setPinging(true);
    setPing(null);
    const url = `${getApiBase()}/health`;
    const started = performance.now();
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const body = await res.text();
      const ms = Math.round(performance.now() - started);
      setPing(`${res.status} in ${ms}ms — ${body.slice(0, 120)}`);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      setPing(`FAILED in ${ms}ms — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPinging(false);
    }
  }

  return (
    <div className="mt-2 rounded-md bg-card p-3 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">Developer settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-sub hover:text-ink"
        >
          Close
        </button>
      </div>

      <label className="block text-xs font-semibold text-sub" htmlFor="dev-api-base">
        API base URL
      </label>
      <input
        id="dev-api-base"
        value={base}
        onChange={(e) => setBase(e.target.value)}
        placeholder="http://192.168.x.x:8000"
        className="mt-1 w-full rounded-md bg-bg px-3 py-2 text-sm text-ink ring-1 ring-line outline-none focus:ring-gold"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={saveBase} className="min-h-[40px] flex-1 !text-sm">
          Save base
        </PrimaryButton>
        <GhostButton
          type="button"
          onClick={() => void runHealthPing()}
          disabled={pinging}
          className="min-h-[40px] flex-1 !text-sm"
        >
          {pinging ? "Pinging…" : "Ping /health"}
        </GhostButton>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={strict}
          onChange={(e) => {
            setStrictLive(e.target.checked);
            setStrict(e.target.checked);
          }}
          className="accent-[var(--gold)]"
        />
        Strict live (no silent mock fallback on photo scan)
      </label>

      {ping ? (
        <p className="mt-2 break-all rounded-sm bg-bg px-2 py-1.5 font-mono text-[11px] text-sub">
          {ping}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-sub">Live API log</h3>
        <button
          type="button"
          onClick={() => clearApiLogs()}
          className="text-[11px] font-semibold text-sub hover:text-ink"
        >
          Clear
        </button>
      </div>

      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-xs text-sub">No requests yet — upload a photo or load appliances.</p>
        ) : (
          logs.map((row) => <LogRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function LogRow({ row }: { row: ApiLogEntry }) {
  const time = new Date(row.ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const tone =
    row.source === "error"
      ? "text-peak"
      : row.source === "mock-fallback"
        ? "text-gold-deep"
        : "text-ink";

  return (
    <div className="rounded-sm bg-bg px-2 py-1.5 font-mono text-[10px] leading-snug ring-1 ring-line">
      <div className={`font-semibold ${tone}`}>
        {row.ok ? "✓" : "✗"} {row.method} {row.path}{" "}
        <span className="font-normal text-sub">
          {row.status ?? "—"} · {row.durationMs}ms · {row.source}
        </span>
      </div>
      <div className="text-sub">{time}</div>
      {(row.summary || row.error) && (
        <div className="mt-0.5 break-all text-sub">{row.summary ?? row.error}</div>
      )}
    </div>
  );
}
