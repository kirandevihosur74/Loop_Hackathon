"use client";

import { useEffect, useState } from "react";
import type { DayForecast } from "@/lib/types";
import { getMonthForecast, getWeekForecast } from "@/lib/data";
import { Pill, SectionHeader } from "@/components/ui";
import { Screen } from "@/components/layout/Screen";
import { WeekStrip } from "@/components/schedule/WeekStrip";
import { MonthGrid } from "@/components/schedule/MonthGrid";
import { AdviceChecklist } from "@/components/schedule/AdviceChecklist";
import { parseISODate } from "@/components/schedule/dateUtils";

type View = "week" | "month";

export default function SchedulePage() {
  const [view, setView] = useState<View>("week");
  const [week, setWeek] = useState<DayForecast[] | null>(null);
  const [month, setMonth] = useState<DayForecast[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Week loads on mount; its first day is "today" and the default selection.
  useEffect(() => {
    let alive = true;
    getWeekForecast().then((days) => {
      if (!alive) return;
      setWeek(days);
      setSelected((cur) => cur ?? days[0]?.date ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Month loads lazily the first time it's shown.
  useEffect(() => {
    if (view !== "month" || month) return;
    let alive = true;
    getMonthForecast().then((days) => alive && setMonth(days));
    return () => {
      alive = false;
    };
  }, [view, month]);

  const today = week?.[0]?.date ?? null;

  const monthLabel =
    view === "month" && month && month[0]
      ? parseISODate(month[0].date).toLocaleDateString(undefined, { month: "long" })
      : null;

  const calendarLoading = view === "week" ? !week : !month;

  return (
    <Screen className="pb-6">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-ink">Schedule</h1>
        <p className="mt-0.5 text-sm text-sub">
          What the agent has planned — tap a day to see its moves.
        </p>
      </div>

      <SectionHeader
        className="mt-4"
        title={view === "week" ? "Your week ahead" : `${monthLabel ?? "This month"} at a glance`}
        subtitle="Dots show grid price: yellow cheap · orange medium · rust peak"
        trailing={
          <div className="flex gap-1.5" role="group" aria-label="Calendar range">
            <Pill active={view === "week"} onClick={() => setView("week")}>
              Week
            </Pill>
            <Pill active={view === "month"} onClick={() => setView("month")}>
              Month
            </Pill>
          </div>
        }
      />

      {calendarLoading || !selected || !today ? (
        <div className="h-24 animate-pulse rounded-md bg-card" />
      ) : view === "week" ? (
        <WeekStrip days={week!} selected={selected} today={today} onSelect={setSelected} />
      ) : (
        <MonthGrid days={month!} selected={selected} today={today} onSelect={setSelected} />
      )}

      <div className="mt-6">
        {selected && today ? (
          <AdviceChecklist date={selected} today={today} />
        ) : (
          <div className="space-y-2">
            <div className="mb-3 h-6 w-52 animate-pulse rounded-md bg-card" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-card" />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
