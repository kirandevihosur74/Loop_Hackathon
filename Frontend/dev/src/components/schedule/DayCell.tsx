"use client";

import type { DayForecast, GridState } from "@/lib/types";
import { cn } from "@/lib/cn";
import { dayOfMonth, usd, weekdayShort } from "./dateUtils";

/** gridState → price-ramp dot fill (yellow cheap / orange medium / rust peak). */
const DOT: Record<GridState, string> = {
  cheap: "bg-cheap",
  medium: "bg-medium",
  expensive: "bg-peak",
};

type DayCellProps = {
  forecast: DayForecast;
  selected: boolean;
  isToday: boolean;
  onSelect: (date: string) => void;
  variant: "week" | "month";
};

/**
 * A single tappable day. Radio semantics (`role="radio"` + `aria-checked`)
 * inside the strip/grid's `radiogroup`. Shows weekday/date, a grid-state dot,
 * and a tiny cost stat. Min 44px tap target both dimensions.
 */
export function DayCell({ forecast, selected, isToday, onSelect, variant }: DayCellProps) {
  const dot = DOT[forecast.gridState];

  if (variant === "week") {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`${weekdayShort(forecast.date)} ${dayOfMonth(forecast.date)}, predicted ${usd(
          forecast.predictedCostUsd,
        )}${isToday ? ", today" : ""}`}
        onClick={() => onSelect(forecast.date)}
        className={cn(
          "flex min-h-[76px] w-[52px] shrink-0 flex-col items-center justify-between rounded-md px-1.5 py-2 shadow-soft transition-colors",
          selected
            ? "bg-gold-tint ring-2 ring-gold"
            : "bg-card ring-1 ring-line hover:ring-gold",
        )}
      >
        <span
          className={cn(
            "text-[11px] font-semibold",
            selected ? "text-gold-deep" : "text-sub",
          )}
        >
          {weekdayShort(forecast.date)}
        </span>
        <span
          className={cn(
            "text-lg leading-none font-bold tabular-nums",
            selected ? "text-gold-deep" : "text-ink",
          )}
        >
          {dayOfMonth(forecast.date)}
        </span>
        <span className={cn("h-2 w-2 rounded-pill", dot)} aria-hidden="true" />
        <span className="text-[10px] font-medium text-sub tabular-nums">
          {usd(forecast.predictedCostUsd)}
        </span>
        <span
          className={cn(
            "h-0.5 w-4 rounded-pill",
            isToday ? "bg-gold" : "bg-transparent",
          )}
          aria-hidden="true"
        />
      </button>
    );
  }

  // month
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${weekdayShort(forecast.date)} ${dayOfMonth(forecast.date)}, predicted ${usd(
        forecast.predictedCostUsd,
      )}${isToday ? ", today" : ""}`}
      onClick={() => onSelect(forecast.date)}
      className={cn(
        "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-md py-1.5 transition-colors",
        selected
          ? "bg-gold-tint ring-2 ring-gold"
          : "bg-card ring-1 ring-line hover:ring-gold",
      )}
    >
      <span
        className={cn(
          "text-sm leading-none font-semibold tabular-nums",
          selected ? "text-gold-deep" : isToday ? "text-gold" : "text-ink",
        )}
      >
        {dayOfMonth(forecast.date)}
      </span>
      <span className={cn("h-1.5 w-1.5 rounded-pill", dot)} aria-hidden="true" />
    </button>
  );
}
