"use client";

import { useEffect, useState } from "react";
import { getLiveUsage, getGridState, getCurrentNudge } from "@/lib/data";
import type { GridState, Nudge, UsagePoint } from "@/lib/types";
import { HomeHero } from "@/components/home/HomeHero";
import { LiveUsageChart } from "@/components/home/LiveUsageChart";
import { NudgeCard } from "@/components/home/NudgeCard";

type Grid = { state: GridState; priceCents: number };

interface HomeData {
  usage: UsagePoint[];
  grid: Grid;
  nudge: Nudge | null;
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getLiveUsage(), getGridState(), getCurrentNudge()]).then(
      ([usage, grid, nudge]) => {
        if (alive) setData({ usage, grid, nudge });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <HomeSkeleton />;

  return (
    <main>
      <HomeHero grid={data.grid} />

      {/* White sheet that overlaps the hero, camping-app style. */}
      <div className="relative z-10 -mt-5 rounded-t-lg bg-card px-4 pb-6 pt-5 shadow-soft">
        <LiveUsageChart initialPoints={data.usage} grid={data.grid} />

        {data.nudge ? (
          <div className="mt-6">
            <NudgeCard nudge={data.nudge} />
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-sub">
            All quiet — nothing needs you right now.
          </p>
        )}
      </div>
    </main>
  );
}

/** Calm pulsing skeleton — no spinners, no layout jump. */
function HomeSkeleton() {
  return (
    <main aria-busy="true">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded-md bg-card" />
          <div className="h-3 w-16 animate-pulse rounded-md bg-card" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-full bg-card" />
      </div>
      <div className="mt-3 h-56 animate-pulse rounded-b-lg bg-card" />
      <div className="relative z-10 -mt-5 rounded-t-lg bg-card px-4 pb-6 pt-5 shadow-soft">
        <div className="h-8 w-32 animate-pulse rounded-md bg-bg" />
        <div className="mt-3 h-32 w-full animate-pulse rounded-md bg-bg" />
        <div className="mt-6 h-40 w-full animate-pulse rounded-lg bg-bg" />
      </div>
    </main>
  );
}
