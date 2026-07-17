"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getPriceForecast, getLiveUsage, getCurrentNudge } from "@/lib/data";
import type { Nudge, PricePoint } from "@/lib/types";
import { HomeHero } from "@/components/home/HomeHero";
import { NudgeCard } from "@/components/home/NudgeCard";
import { enter, staggerContainer, noMotion } from "@/lib/motion";

interface HomeData {
  forecast: PricePoint[];
  nowHour: number;
  watts: number;
  nudge: Nudge | null;
}

export default function HomePage() {
  const reduced = useReducedMotion();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getPriceForecast(), getLiveUsage(), getCurrentNudge()]).then(
      ([forecast, usage, nudge]) => {
        if (!alive) return;
        const now = new Date();
        const nowHour = now.getHours() + now.getMinutes() / 60;
        const watts = usage.length ? usage[usage.length - 1].watts : 0;
        setData({ forecast, nowHour, watts, nudge });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <HomeSkeleton />;

  const container = reduced ? noMotion : staggerContainer;
  const item = reduced ? noMotion : enter;

  return (
    <motion.main className="pb-4" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <HomeHero forecast={data.forecast} nowHour={data.nowHour} />
      </motion.div>

      {/* Running now */}
      <motion.div variants={item} className="mt-3 flex items-center gap-2.5 px-4">
        <span
          className="h-2 w-2 rounded-full bg-gold"
          style={{ boxShadow: "0 0 0 4px var(--gold-l)" }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-sub">Running now</span>
        <span className="ml-auto text-[15px] font-bold tabular-nums text-ink">
          {data.watts.toLocaleString()} W
        </span>
      </motion.div>

      {/* The one thing to act on */}
      <motion.div variants={item} className="mt-3 px-3.5">
        {data.nudge ? (
          <NudgeCard nudge={data.nudge} />
        ) : (
          <p className="py-6 text-center text-sm text-sub">All quiet — nothing needs you right now.</p>
        )}
      </motion.div>
    </motion.main>
  );
}

/** Calm pulsing skeleton — no spinners, no layout jump. */
function HomeSkeleton() {
  return (
    <main aria-busy="true">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="space-y-1.5">
          <div className="h-5 w-28 animate-pulse rounded-md bg-card" />
          <div className="h-3 w-16 animate-pulse rounded-md bg-card" />
        </div>
        <div className="h-[38px] w-[38px] animate-pulse rounded-full bg-card" />
      </div>
      <div className="mt-3 px-3.5">
        <div className="h-64 w-full animate-pulse rounded-[11px] bg-card" />
      </div>
      <div className="mt-3 px-3.5">
        <div className="h-40 w-full animate-pulse rounded-[11px] bg-card" />
      </div>
    </main>
  );
}
