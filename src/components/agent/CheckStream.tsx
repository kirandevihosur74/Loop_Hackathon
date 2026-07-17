"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { AgentCheck } from "@/lib/types";
import { ease, noMotion, staggerRow } from "@/lib/motion";
import { cn } from "@/lib/cn";

export type CheckPhase = "checking" | "done";

/** A single spinning ring while a check is in progress. */
function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <span
      className={cn(
        "block h-4 w-4 rounded-full border-2 border-line border-t-green",
        !reduce && "animate-spin",
      )}
    />
  );
}

/** Green tick once a check has resolved. */
function CheckIcon() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green text-white">
      <svg
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2.5 6.2l2.2 2.2 4.8-5" />
      </svg>
    </span>
  );
}

/**
 * The streamed checklist. The page reveals each check on a timed cadence by
 * populating `phases`; a row shows a spinner while `checking` and flips to a
 * green tick + its finding when `done`.
 */
export function CheckStream({
  checks,
  phases,
}: {
  checks: AgentCheck[];
  phases: Record<string, CheckPhase>;
}) {
  const reduce = useReducedMotion();
  const revealed = checks.filter((c) => phases[c.id]);
  if (revealed.length === 0) return null;

  return (
    <ul className="space-y-2" aria-label="Agent checks">
      {revealed.map((c) => {
        const done = phases[c.id] === "done";
        return (
          <motion.li
            key={c.id}
            variants={reduce ? noMotion : staggerRow}
            initial="hidden"
            animate="show"
            className="flex items-start gap-3 rounded-md bg-card p-3 shadow-soft ring-1 ring-line"
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {done ? <CheckIcon /> : <Spinner reduce={!!reduce} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{c.label}</p>
              {done && (
                <motion.p
                  initial={reduce ? undefined : { opacity: 0 }}
                  animate={reduce ? undefined : { opacity: 1 }}
                  transition={{ duration: 0.3, ease }}
                  className="mt-0.5 text-sm text-sub"
                >
                  {c.finding}
                </motion.p>
              )}
            </div>
            <span className="sr-only">
              {done ? `Done: ${c.finding}` : `Checking ${c.label}`}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
