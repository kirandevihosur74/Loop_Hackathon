"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { enter, noMotion } from "@/lib/motion";
import { Screen } from "@/components/layout/Screen";
import { Card, ConfidenceBadge, PrimaryButton } from "@/components/ui";
import { getLedger, runAgentCheck } from "@/lib/data";
import type { AgentRunResult, LedgerEntry } from "@/lib/types";
import { Butterfly } from "@/components/agent/Butterfly";
import { CheckStream, type CheckPhase } from "@/components/agent/CheckStream";
import { SelfCorrectionCard } from "@/components/agent/SelfCorrectionCard";
import { TrustLedger } from "@/components/agent/TrustLedger";

/** Idle countdown length — a calm "next check in mm:ss" that loops. */
const NEXT_CHECK_SECONDS = 15 * 60;

// Streaming cadence (ms).
const ROW_GAP = 600; // between the start of each check row
const ROW_SETTLE = 460; // spinner → finding within a row
const CORRECTION_LEAD = 600; // pause before the self-correction reveals
const CORRECTION_ROOM = 2600; // time given to the self-correction beat

export default function AgentPage() {
  const reduce = useReducedMotion();

  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);

  const [working, setWorking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<AgentRunResult | null>(null);
  const [phases, setPhases] = useState<Record<string, CheckPhase>>({});
  const [showCorrection, setShowCorrection] = useState(false);

  const [remaining, setRemaining] = useState(NEXT_CHECK_SECONDS);
  // Completed runs this session — lifts the trust-ledger count so it animates up.
  const [runsCompleted, setRunsCompleted] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Ledger — fetched on mount behind a calm skeleton.
  useEffect(() => {
    let alive = true;
    getLedger().then((l) => {
      if (alive) setLedger(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Idle countdown — ticks only while the agent is not actively working.
  useEffect(() => {
    if (working) return;
    const iv = setInterval(() => {
      setRemaining((r) => (r <= 1 ? NEXT_CHECK_SECONDS : r - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [working]);

  // Clean up any pending stream timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  const runCheck = useCallback(async () => {
    if (busy) return;
    clearTimers();
    setBusy(true);
    setWorking(true);
    setRun(null);
    setPhases({});
    setShowCorrection(false);

    const result = await runAgentCheck();
    setRun(result);

    // Reduced motion: reveal everything at once, no per-row cadence / flourish.
    if (reduce) {
      const done: Record<string, CheckPhase> = {};
      result.checks.forEach((c) => {
        done[c.id] = "done";
      });
      setPhases(done);
      if (result.selfCorrected) setShowCorrection(true);
      setWorking(false);
      setBusy(false);
      setRunsCompleted((n) => n + 1);
      return;
    }

    // Stream each check: appear as "checking", then settle to "done".
    let t = 200;
    result.checks.forEach((c) => {
      timers.current.push(
        setTimeout(() => setPhases((p) => ({ ...p, [c.id]: "checking" })), t),
      );
      timers.current.push(
        setTimeout(
          () => setPhases((p) => ({ ...p, [c.id]: "done" })),
          t + ROW_SETTLE,
        ),
      );
      t += ROW_GAP;
    });

    const afterChecks = t + 250;
    if (result.selfCorrected) {
      timers.current.push(
        setTimeout(() => setShowCorrection(true), afterChecks + CORRECTION_LEAD),
      );
      timers.current.push(
        setTimeout(() => {
          setWorking(false);
          setBusy(false);
          setRunsCompleted((n) => n + 1);
        }, afterChecks + CORRECTION_LEAD + CORRECTION_ROOM),
      );
    } else {
      timers.current.push(
        setTimeout(() => {
          setWorking(false);
          setBusy(false);
          setRunsCompleted((n) => n + 1);
        }, afterChecks + 300),
      );
    }
  }, [busy, reduce, clearTimers]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const status = working
    ? "Checking your home…"
    : `Watching · next check in ${mm}:${ss}`;

  const checksDone = run
    ? run.checks.every((c) => phases[c.id] === "done")
    : false;

  return (
    <Screen className="pb-8">
      <div className="pt-2">
        <Butterfly working={working} />
        <p className="mt-3 text-center text-sm text-sub">{status}</p>
      </div>

      <div className="mt-6">
        <PrimaryButton onClick={runCheck} disabled={busy} aria-label="Run a check now">
          {busy ? "Running a check…" : "Run a check"}
        </PrimaryButton>
      </div>

      {run && (
        <div className="mt-5 space-y-3">
          <CheckStream checks={run.checks} phases={phases} />

          {showCorrection && run.selfCorrected && (
            <SelfCorrectionCard prev={run.result} corrected={run.selfCorrected} />
          )}

          {/* Fallback: if the agent didn't self-correct, surface the final rec. */}
          {checksDone && !run.selfCorrected && (
            <motion.div variants={reduce ? noMotion : enter} initial="hidden" animate="show">
              <Card className="bg-gold-tint">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{run.result.title}</p>
                  <ConfidenceBadge level={run.result.confidence} className="shrink-0" />
                </div>
                <p className="mt-1 text-xs text-sub">{run.result.detail}</p>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      <div className="mt-8">
        {ledger === null ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-6 w-40 animate-pulse rounded-md bg-card" />
            <div className="h-16 animate-pulse rounded-lg bg-card" />
            <div className="h-16 animate-pulse rounded-lg bg-card" />
          </div>
        ) : (
          <TrustLedger entries={ledger} bump={runsCompleted} />
        )}
      </div>
    </Screen>
  );
}
