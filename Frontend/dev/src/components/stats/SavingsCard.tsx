"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { StatTile } from "@/components/ui";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";

/** Counts a dollar figure up from 0 → `to` once `active`; instant when reduced. */
function useCountUp(to: number, active: boolean, reduce: boolean | null) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    const controls = animate(0, to, { duration: 1.1, ease, onUpdate: setValue });
    return () => controls.stop();
  }, [to, active, reduce]);
  // When reduced motion is on, skip the animation and show the final value.
  return reduce ? to : value;
}

/** A single labelled benchmark bar (you vs. neighbors). */
function BenchBar({
  label,
  amount,
  fraction,
  fill,
  inView,
}: {
  label: string;
  amount: number;
  fraction: number;
  fill: string;
  inView: boolean;
}) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums font-semibold text-ink">${amount.toFixed(2)}</span>
      </div>
      <div
        className="mt-1 h-3 w-full overflow-hidden rounded-sm"
        style={{ backgroundColor: cssVar.line }}
        role="img"
        aria-label={`${label}: $${amount.toFixed(2)} for this range.`}
      >
        <motion.div
          className="h-full rounded-sm"
          style={{ backgroundColor: fill }}
          initial={false}
          animate={{ width: reduce || inView ? `${pct}%` : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease }}
        />
      </div>
    </div>
  );
}

/**
 * Savings block: a gold headline tile for money saved this month, plus a
 * two-bar "vs neighbors" benchmark comparing your spend to a typical neighbor.
 */
export function SavingsCard({
  savedThisMonthUsd,
  neighborsAvgUsd,
  youSpendUsd,
}: {
  savedThisMonthUsd: number;
  neighborsAvgUsd: number;
  youSpendUsd: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const saved = useCountUp(savedThisMonthUsd, inView, reduce);

  const max = Math.max(neighborsAvgUsd, youSpendUsd, 0.01);
  const cheaper = youSpendUsd < neighborsAvgUsd;
  const diff = Math.abs(neighborsAvgUsd - youSpendUsd);

  return (
    <div ref={ref} className="flex flex-col gap-3">
      <StatTile
        label="Saved this month"
        value={`$${saved.toFixed(2)}`}
        hint="from letting the agent shift your usage to cheaper hours"
        tone="green"
        className="bg-gold-tint"
      />
      <div className="rounded-lg bg-card p-4 shadow-soft">
        <div className="mb-3 text-sm font-semibold text-ink">
          {cheaper
            ? `You're spending $${diff.toFixed(2)} less than nearby homes`
            : `You're spending $${diff.toFixed(2)} more than nearby homes`}
        </div>
        <div className="flex flex-col gap-3">
          <BenchBar
            label="You"
            amount={youSpendUsd}
            fraction={youSpendUsd / max}
            fill={cheaper ? cssVar.gold : cssVar.peak}
            inView={inView}
          />
          <BenchBar
            label="Neighbors' avg"
            amount={neighborsAvgUsd}
            fraction={neighborsAvgUsd / max}
            fill={cssVar.sub}
            inView={inView}
          />
        </div>
      </div>
    </div>
  );
}
