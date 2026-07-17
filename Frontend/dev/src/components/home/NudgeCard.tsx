"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Nudge } from "@/lib/types";
import { Card, ConfidenceBadge, PrimaryButton, GhostButton } from "@/components/ui";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";

type Acted = "pending" | "done" | "later" | "reverted";

/**
 * The single Home nudge. Stakes-first title, a ConfidenceBadge, savings + credits,
 * and actions. A recommended nudge offers "Do it" / "Later"; an auto-acted one
 * shows a calm "Handled — undo" state instead. Acting pops a one-time "+N" credits
 * chip (a nice touch, not confetti).
 */
export function NudgeCard({ nudge }: { nudge: Nudge }) {
  const reduced = useReducedMotion();
  const autoActed = nudge.status === "auto_acted";
  const [acted, setActed] = useState<Acted>(autoActed ? "done" : "pending");
  const [showPop, setShowPop] = useState(false);

  function celebrate() {
    if (!nudge.credits) return;
    setShowPop(true);
    window.setTimeout(() => setShowPop(false), 1400);
  }

  function onDoIt() {
    setActed("done");
    celebrate();
  }

  const tone = autoActed
    ? "bg-green-light ring-green/20"
    : "bg-bg ring-line";

  return (
    <Card className={cn("relative overflow-hidden ring-1", tone)}>
      {/* One-time "+N credits" pop */}
      <AnimatePresence>
        {showPop && nudge.credits ? (
          <motion.div
            key="pop"
            className="pointer-events-none absolute right-4 top-4 rounded-pill bg-green px-2.5 py-1 text-xs font-bold text-white shadow-soft"
            initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: -6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            +{nudge.credits}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sub">
          {autoActed ? "Handled for you" : "One thing"}
        </p>
        <ConfidenceBadge level={nudge.confidence} />
      </div>

      <h2 className="mt-2 text-base font-semibold leading-snug text-ink">
        {nudge.title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-sub">{nudge.detail}</p>

      {/* Evidence flow strip */}
      {nudge.flow && nudge.flow.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {nudge.flow.map((step, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span className="text-sub">→</span> : null}
              <span className="rounded-pill bg-card px-2 py-0.5 text-xs ring-1 ring-line">
                <span className="text-sub">{step.label} </span>
                <span className="font-semibold text-ink">{step.value}</span>
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Savings + credits */}
      {(nudge.savingsUsd !== undefined || nudge.credits !== undefined) && (
        <p className="mt-3 text-sm font-semibold text-green-deep">
          {nudge.savingsUsd !== undefined ? `Saves $${nudge.savingsUsd.toFixed(2)}` : ""}
          {nudge.savingsUsd !== undefined && nudge.credits !== undefined ? " · " : ""}
          {nudge.credits !== undefined ? `+${nudge.credits} credits` : ""}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4">
        {autoActed ? (
          acted === "reverted" ? (
            <p className="text-sm text-sub" role="status">
              Reverted — back to how it was.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-deep">
                <CheckIcon /> Handled
              </span>
              <GhostButton className="min-w-[96px]" onClick={() => setActed("reverted")}>
                Undo
              </GhostButton>
            </div>
          )
        ) : acted === "done" ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-deep" role="status">
            <CheckIcon /> Done
            {nudge.savingsUsd !== undefined ? ` — saved $${nudge.savingsUsd.toFixed(2)}` : ""}
          </p>
        ) : acted === "later" ? (
          <p className="text-sm text-sub" role="status">
            Okay — I&apos;ll keep an eye on it.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <PrimaryButton className="flex-1" onClick={onDoIt}>
              Do it
            </PrimaryButton>
            <GhostButton className="min-w-[96px]" onClick={() => setActed("later")}>
              Later
            </GhostButton>
          </div>
        )}
      </div>
    </Card>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
