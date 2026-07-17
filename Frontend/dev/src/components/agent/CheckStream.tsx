"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AgentCheck } from "@/lib/types";
import { ease, noMotion, springSoft, staggerRow } from "@/lib/motion";
import { cssVar } from "@/lib/tokens";

export type CheckPhase = "checking" | "done";

/** Short reasoning voiced while each check runs — evolves as the agent works. */
const REASONING: Record<string, string> = {
  c1: "Prices are steep right now — peak holds till 9, so anything flexible should wait.",
  c2: "Sun holds till 3, then it clouds over — solar won't carry the afternoon.",
  c3: "Your Tesla's low but doesn't leave till 7:30, so there's room to shift the charge.",
  c4: "Solar's covering the house for now, but that won't last as the clouds roll in.",
  c5: "Dishwasher's loaded — worth a closer look at the cheaper overnight window.",
};

/**
 * A circular spinner that both spins and fills: a faint track ring with a gold
 * arc sweeping around it. Reduced motion shows a calm static ring instead.
 */
function Spinner({ reduce }: { reduce: boolean }) {
  const R = 7;
  const C = 2 * Math.PI * R;
  return (
    <motion.svg
      viewBox="0 0 18 18"
      className="h-4 w-4"
      fill="none"
      aria-hidden
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { duration: 0.9, ease: "linear", repeat: Infinity }}
    >
      <circle cx="9" cy="9" r={R} stroke={cssVar.line} strokeWidth={2} />
      <circle
        cx="9"
        cy="9"
        r={R}
        stroke={cssVar.gold}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={reduce ? C * 0.6 : C * 0.72}
      />
    </motion.svg>
  );
}

/** Gold tick once a check has resolved — pops in with a soft spring as the
 *  spinning ring settles. Reduced motion: appears instantly, no pop. */
function CheckIcon({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-white"
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={reduce ? undefined : { scale: 1, opacity: 1 }}
      transition={springSoft}
    >
      <motion.svg
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <motion.path
          d="M2.5 6.2l2.2 2.2 4.8-5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 0.28, ease, delay: 0.08 }}
        />
      </motion.svg>
    </motion.span>
  );
}

/**
 * The streamed checklist. The page reveals each check on a timed cadence by
 * populating `phases`; a row shows a spinning gold ring while `checking` and
 * flips to a gold tick + its finding when `done`. Beneath the currently-active
 * row, a short reasoning line fades in and evolves as the checks progress.
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

  // The active check is the latest revealed row still spinning.
  const active = [...revealed].reverse().find((c) => phases[c.id] === "checking");

  return (
    <ul className="space-y-2" aria-label="Agent checks">
      {revealed.map((c) => {
        const done = phases[c.id] === "done";
        const isActive = active?.id === c.id;
        return (
          <li key={c.id}>
            <motion.div
              variants={reduce ? noMotion : staggerRow}
              initial="hidden"
              animate="show"
              className="flex items-start gap-3 rounded-md bg-card p-3 shadow-soft ring-1 ring-line"
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                {done ? <CheckIcon reduce={!!reduce} /> : <Spinner reduce={!!reduce} />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{c.label}</p>
                {done && (
                  <motion.p
                    initial={reduce ? undefined : { opacity: 0, y: -2 }}
                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease, delay: 0.06 }}
                    className="mt-0.5 text-sm text-sub"
                  >
                    {c.finding}
                  </motion.p>
                )}
              </div>
              <span className="sr-only">
                {done ? `Done: ${c.finding}` : `Checking ${c.label}`}
              </span>
            </motion.div>

            {/* Evolving reasoning line, tucked beneath the active check. */}
            {!reduce && (
              <AnimatePresence mode="wait">
                {isActive && REASONING[c.id] && (
                  <motion.p
                    key={c.id}
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="px-3 pt-1.5 text-xs italic text-sub"
                    aria-hidden
                  >
                    {REASONING[c.id]}
                  </motion.p>
                )}
              </AnimatePresence>
            )}
          </li>
        );
      })}
    </ul>
  );
}
