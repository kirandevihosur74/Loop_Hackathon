"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getStats } from "@/lib/data";
import type { StatsSummary } from "@/lib/types";
import { Screen } from "@/components/layout/Screen";
import { Card, Pill, SectionHeader } from "@/components/ui";
import { enter, noMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { TimingRing } from "@/components/stats/TimingRing";
import { HourlyBars } from "@/components/stats/HourlyBars";
import { ApplianceBars } from "@/components/stats/ApplianceBars";
import { SplitRings } from "@/components/stats/SplitRings";
import { SavingsCard } from "@/components/stats/SavingsCard";

type Range = "day" | "week" | "month";

const RANGES: { value: Range; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-56 animate-pulse rounded-lg bg-card" />
      <div className="h-48 animate-pulse rounded-lg bg-card" />
      <div className="h-56 animate-pulse rounded-lg bg-card" />
      <div className="h-40 animate-pulse rounded-lg bg-card" />
    </div>
  );
}

export default function StatsPage() {
  const reduce = useReducedMotion();
  const [range, setRange] = useState<Range>("day");
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    let alive = true;
    getStats(range).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [range]);

  // Old data stays visible (dimmed) while a new range is in flight.
  const loading = stats !== null && stats.range !== range;

  const variants = reduce ? noMotion : enter;

  return (
    <Screen className="pb-6">
      <SectionHeader
        title="Your electricity"
        subtitle="How you used it — and what it cost."
        trailing={
          <div className="flex gap-1.5" role="group" aria-label="Choose a time range">
            {RANGES.map((r) => (
              <Pill
                key={r.value}
                active={range === r.value}
                onClick={() => setRange(r.value)}
                aria-label={`Show ${r.label} stats`}
              >
                {r.label}
              </Pill>
            ))}
          </div>
        }
      />

      {!stats ? (
        <StatsSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            loading ? "opacity-60" : "opacity-100",
          )}
          aria-busy={loading}
        >
          {/* 1 — Timing score hero ring */}
          <motion.div initial="hidden" animate="show" variants={variants}>
            <Card className="flex flex-col items-center gap-3 text-center">
              <TimingRing pct={stats.timingScorePct} />
              <p className="max-w-[16rem] text-sm text-ink">
                You used <span className="font-semibold">{stats.timingScorePct}%</span> of your
                power during cheap, clean hours.
              </p>
              <p className="text-xs text-sub">
                {stats.totalKwh} kWh · ${stats.totalCostUsd.toFixed(2)} this{" "}
                {range === "day" ? "day" : range}
              </p>
            </Card>
          </motion.div>

          {/* 2 — Hourly bars */}
          <motion.div initial="hidden" animate="show" variants={variants}>
            <Card>
              <SectionHeader
                title="When you used it"
                subtitle="Taller bars in yellow hours mean cheaper, cleaner power."
              />
              <HourlyBars hourly={stats.hourly} />
            </Card>
          </motion.div>

          {/* 3 — Where your watts go */}
          <motion.div initial="hidden" animate="show" variants={variants}>
            <Card>
              <SectionHeader
                title="Where your watts go"
                subtitle={`$${stats.totalCostUsd.toFixed(2)} across your appliances`}
              />
              <ApplianceBars items={stats.byAppliance} />
            </Card>
          </motion.div>

          {/* 4 — Home vs Car split */}
          <motion.div initial="hidden" animate="show" variants={variants}>
            <Card>
              <SectionHeader title="Home vs car" subtitle="Where the energy went" />
              <SplitRings home={stats.split.home} car={stats.split.car} />
            </Card>
          </motion.div>

          {/* 5 — Savings + vs neighbors */}
          <motion.div initial="hidden" animate="show" variants={variants}>
            <SavingsCard
              savedThisMonthUsd={stats.savedThisMonthUsd}
              neighborsAvgUsd={stats.neighborsAvgUsd}
              youSpendUsd={stats.youSpendUsd}
            />
          </motion.div>
        </div>
      )}
    </Screen>
  );
}
