"use client";

import type { DayForecast } from "@/lib/types";
import { DayCell } from "./DayCell";

type WeekStripProps = {
  days: DayForecast[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
};

/** Horizontally scrollable strip of 7 day cells. */
export function WeekStrip({ days, selected, today, onSelect }: WeekStripProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Pick a day this week"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {days.map((d) => (
        <DayCell
          key={d.date}
          forecast={d}
          selected={d.date === selected}
          isToday={d.date === today}
          onSelect={onSelect}
          variant="week"
        />
      ))}
    </div>
  );
}
