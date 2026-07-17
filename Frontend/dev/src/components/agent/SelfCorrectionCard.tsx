"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Nudge } from "@/lib/types";
import { ConfidenceBadge } from "@/components/ui";
import { ease, enter, noMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The hero beat: the agent revises its prior recommendation as new evidence
 * arrives. The old rec strikes through as the new one rises in, and the
 * confidence badge visibly shifts from the old level to the new. Reveal is
 * driven by the parent (this only mounts once the checks have settled); the
 * internal strike-through "shift" is given room via a short timer.
 */
export function SelfCorrectionCard({
  prev,
  corrected,
}: {
  prev: Nudge;
  corrected: Nudge;
}) {
  const reduce = useReducedMotion();
  // Non-reduced motion drives the strike-through via a short timer; reduced
  // motion is derived (always shifted) so we never setState inside the effect.
  const [timed, setTimed] = useState(false);
  const shifted = reduce ? true : timed;

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setTimed(true), 1100);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <motion.div
      variants={reduce ? noMotion : enter}
      initial="hidden"
      animate="show"
      className="rounded-md bg-peak-tint p-4 shadow-soft"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-peak">
        <span aria-hidden className="text-lg leading-none">
          ↺
        </span>
        <p className="text-sm font-bold">Changed its mind</p>
      </div>

      <div className="mt-3 space-y-3">
        {/* The prior recommendation — strikes through once the agent revises. */}
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-sm transition-all duration-500",
              shifted ? "text-sub line-through" : "font-semibold text-ink",
            )}
          >
            {prev.title}
          </p>
          <ConfidenceBadge
            level={prev.confidence}
            className={cn(
              "shrink-0 transition-opacity duration-500",
              shifted && "opacity-40",
            )}
          />
        </div>

        {/* The revised recommendation. */}
        {shifted && (
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 6 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="flex items-start justify-between gap-3"
          >
            <p className="text-sm font-semibold text-ink">{corrected.title}</p>
            <ConfidenceBadge level={corrected.confidence} className="shrink-0" />
          </motion.div>
        )}
      </div>

      {shifted && (
        <motion.p
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.4, ease, delay: 0.1 }}
          className="mt-3 text-xs text-sub"
        >
          {corrected.detail}
        </motion.p>
      )}
    </motion.div>
  );
}
