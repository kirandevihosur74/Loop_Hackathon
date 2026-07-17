"use client";

import type { DayForecast } from "@/lib/types";
import { DayCell } from "./DayCell";
import { weekdayIndex } from "./dateUtils";

const WEEKDAY_HEADS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type MonthGridProps = {
  days: DayForecast[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
};

/** Compact month grid — weekday header row + 7-column day cells, leading blanks. */
export function MonthGrid({ days, selected, today, onSelect }: MonthGridProps) {
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
      <div role="radiogroup" aria-label="Pick a day this month" className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((d) => (
          <DayCell
            key={d.date}
            forecast={d}
            selected={d.date === selected}
            isToday={d.date === today}
            onSelect={onSelect}
            variant="month"
          />
        ))}
      </div>
    </div>
  );
}
