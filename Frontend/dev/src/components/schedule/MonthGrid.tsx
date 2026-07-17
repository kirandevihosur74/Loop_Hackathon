"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { DayForecast } from "@/lib/types";
import { noMotion, staggerRow } from "@/lib/motion";
import { DayCell } from "./DayCell";
import { weekdayIndex } from "./dateUtils";

const WEEKDAY_HEADS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Tighter stagger than the shared container — a month is ~30 cells. */
const monthContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025, delayChildren: 0.03 } },
};

type MonthGridProps = {
  days: DayForecast[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
};

/** Compact month grid — weekday header row + 7-column day cells, leading blanks. */
export function MonthGrid({ days, selected, today, onSelect }: MonthGridProps) {
  const reduce = useReducedMotion();
  const lead = days.length > 0 ? weekdayIndex(days[0].date) : 0;

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY_HEADS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-sub"
            aria-hidden="true"
          >
            {w}
          </div>
        ))}
      </div>
      <motion.div
        role="radiogroup"
        aria-label="Pick a day this month"
        className="grid grid-cols-7 gap-1.5"
        variants={reduce ? noMotion : monthContainer}
        initial="hidden"
        animate="show"
      >
        {Array.from({ length: lead }, (_, i) => (
          <div key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((d) => (
          <motion.div key={d.date} variants={reduce ? noMotion : staggerRow}>
            <DayCell
              forecast={d}
              selected={d.date === selected}
              isToday={d.date === today}
              onSelect={onSelect}
              variant="month"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
