"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DayForecast } from "@/lib/types";
import { noMotion, staggerContainer, staggerRow } from "@/lib/motion";
import { DayCell } from "./DayCell";

type WeekStripProps = {
  days: DayForecast[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
};

/** Horizontally scrollable strip of 7 day cells, staggered in on mount. */
export function WeekStrip({ days, selected, today, onSelect }: WeekStripProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="radiogroup"
      aria-label="Pick a day this week"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      variants={reduce ? noMotion : staggerContainer}
      initial="hidden"
      animate="show"
    >
      {days.map((d) => (
        <motion.div
          key={d.date}
          variants={reduce ? noMotion : staggerRow}
          className="shrink-0"
        >
          <DayCell
            forecast={d}
            selected={d.date === selected}
            isToday={d.date === today}
            onSelect={onSelect}
            variant="week"
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
