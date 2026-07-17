"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AdviceItem } from "@/lib/types";
import { getAdviceForDate, toggleAdvice } from "@/lib/data";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";
import { noMotion, staggerContainer, staggerRow, springSoft } from "@/lib/motion";
import { usd, weekdayLong } from "./dateUtils";

function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type AdviceChecklistProps = {
  date: string;
  today: string;
};

/**
 * The emotional core: the selected day's plan. Checkable rows with a
 * satisfying green check, struck/dimmed done text, staggered reveal, and a
 * per-day potential-savings tally. Optimistic toggle per SWARM_PLAN §4.
 */
export function AdviceChecklist({ date, today }: AdviceChecklistProps) {
  const reduce = useReducedMotion();
  // Hold the items together with the date they were fetched for, so "loading"
  // is derived (fetched !== date) rather than set synchronously in the effect.
  const [data, setData] = useState<{ date: string; items: AdviceItem[] } | null>(null);

  useEffect(() => {
    let alive = true;
    getAdviceForDate(date).then((xs) => alive && setData({ date, items: xs }));
    return () => {
      alive = false;
    };
  }, [date]);

  const items = data && data.date === date ? data.items : null;

  async function onToggle(id: string) {
    setData((d) =>
      d ? { ...d, items: d.items.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) } : d,
    );
    try {
      await toggleAdvice(id);
    } catch {
      setData({ date, items: await getAdviceForDate(date) });
    }
  }

  const heading =
    date === today ? "Here's your plan for today" : `Here's your plan for ${weekdayLong(date)}`;

  if (!items) {
    return (
      <div>
        <div className="mb-3 h-6 w-52 animate-pulse rounded-pill bg-card" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const totalPotential = items.reduce((s, x) => s + (x.savingsUsd ?? 0), 0);
  const captured = items.filter((x) => x.done).reduce((s, x) => s + (x.savingsUsd ?? 0), 0);
  const allDone = items.length > 0 && items.every((x) => x.done);

  const variants = reduce ? noMotion : staggerRow;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-ink">{heading}</h2>
      </div>
      <p className="mb-3 text-sm text-sub">
        {totalPotential > 0 ? (
          <>
            Save up to{" "}
            <span className="font-semibold text-green">{usd(totalPotential)}</span> today
            {captured > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-green-deep">{usd(captured)}</span> captured
              </>
            )}
          </>
        ) : (
          "No moves needed — you're already coasting."
        )}
      </p>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-sub">Nothing to do here. Enjoy the quiet.</p>
        </Card>
      ) : (
        <motion.ul
          key={date}
          variants={reduce ? noMotion : staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          {items.map((item) => (
            <motion.li key={item.id} variants={variants}>
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                onClick={() => onToggle(item.id)}
                className={cn(
                  "flex min-h-[56px] w-full items-center gap-3 rounded-lg p-3.5 text-left shadow-soft transition-colors",
                  item.done ? "bg-green-light" : "bg-card ring-1 ring-line",
                )}
              >
                <motion.span
                  aria-hidden="true"
                  animate={
                    reduce ? undefined : { scale: item.done ? [1, 1.25, 1] : 1 }
                  }
                  transition={springSoft}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-2 transition-colors",
                    item.done
                      ? "border-green bg-green text-white"
                      : "border-line bg-card text-transparent",
                  )}
                >
                  <CheckMark />
                </motion.span>

                <span
                  className={cn(
                    "flex-1 text-sm transition-colors",
                    item.done ? "text-sub line-through" : "text-ink",
                  )}
                >
                  {item.text}
                </span>

                {item.savingsUsd != null && (
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      item.done ? "text-green-deep" : "text-green",
                    )}
                  >
                    {usd(item.savingsUsd)}
                  </span>
                )}
              </button>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {allDone && (
        <p className="mt-3 text-center text-sm font-semibold text-green-deep">
          Plan complete — nice work.
        </p>
      )}
    </div>
  );
}
