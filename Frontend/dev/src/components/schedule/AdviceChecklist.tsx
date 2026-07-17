"use client";

import { useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import type { AdviceItem } from "@/lib/types";
import { getAdviceForDate, toggleAdvice } from "@/lib/data";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";
import { ease, noMotion, staggerContainer, staggerRow, springSoft } from "@/lib/motion";
import { usd, weekdayLong } from "./dateUtils";

/** The tick: strokes itself on when `done` flips, retracts when unchecked. */
function CheckMark({ done, reduce }: { done: boolean; reduce: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <motion.path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: done ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : springSoft}
      />
    </svg>
  );
}

/** A USD figure that rolls up to its new target (e.g. as savings are captured). */
function UsdCountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => usd(v));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6, ease });
    return controls.stop;
  }, [value, reduce, mv]);

  if (reduce) return <>{usd(value)}</>;
  return <motion.span>{text}</motion.span>;
}

type AdviceChecklistProps = {
  date: string;
  today: string;
};

/**
 * The emotional core: the selected day's plan. Checkable rows with a
 * satisfying gold check, struck/dimmed done text, staggered reveal, and a
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
        <div className="mb-3 h-6 w-52 animate-pulse rounded-md bg-card" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-card" />
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
            <span className="font-bold text-gold-deep tabular-nums">
              <UsdCountUp value={totalPotential} reduce={!!reduce} />
            </span>{" "}
            today
            {captured > 0 && (
              <>
                {" · "}
                <span className="font-bold text-gold-deep tabular-nums">
                  <UsdCountUp value={captured} reduce={!!reduce} />
                </span>{" "}
                captured
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
                  "flex min-h-[56px] w-full items-center gap-3 rounded-md p-3.5 text-left shadow-soft transition-colors",
                  item.done ? "bg-gold-tint" : "bg-card ring-1 ring-line",
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
                      ? "border-gold bg-gold text-white"
                      : "border-line bg-card text-transparent",
                  )}
                >
                  <CheckMark done={item.done} reduce={!!reduce} />
                </motion.span>

                <span
                  className={cn(
                    "relative flex-1 text-sm transition-colors",
                    item.done ? "text-sub" : "text-ink",
                  )}
                >
                  {item.text}
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ scaleX: item.done ? 1 : 0 }}
                    transition={reduce ? { duration: 0 } : springSoft}
                    className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left -translate-y-1/2 bg-current"
                  />
                </span>

                {item.savingsUsd != null && (
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      item.done ? "text-gold-deep" : "text-gold-deep",
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
        <p className="mt-3 text-center text-sm font-semibold text-gold-deep">
          Plan complete — nice work.
        </p>
      )}
    </div>
  );
}
