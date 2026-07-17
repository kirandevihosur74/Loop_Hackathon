"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GridState, UsagePoint } from "@/lib/types";
import { gridColor } from "@/lib/tokens";
import { ease } from "@/lib/motion";

const VIEW_W = 340;
const VIEW_H = 132;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;

const rateTone: Record<GridState, string> = {
  cheap: "text-green",
  medium: "text-amber",
  expensive: "text-red",
};

/**
 * The "Running now" centerpiece: a hand-rolled SVG live area chart of household
 * watts over the last ~2h. A big current-watts number + price rate sit above it.
 * The area/line are colored by the current grid state. Every ~4s we append a new
 * eased point (drifting the last value); the interval is cleared on unmount and
 * skipped entirely under reduced motion.
 */
export function LiveUsageChart({
  initialPoints,
  grid,
}: {
  initialPoints: UsagePoint[];
  grid: { state: GridState; priceCents: number };
}) {
  const reduced = useReducedMotion();
  const [points, setPoints] = useState<UsagePoint[]>(initialPoints);
  const seedRef = useRef(0.5);

  // Live drift: append a new point every ~4s, keep the window length constant so
  // the SVG path always has the same command count (framer-motion can ease it).
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setPoints((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        // Deterministic-ish gentle wander so it feels alive, not jittery.
        seedRef.current = (seedRef.current * 9301 + 49297) % 233280;
        const rnd = seedRef.current / 233280;
        const drift = (rnd - 0.5) * 180;
        const watts = Math.min(1600, Math.max(180, Math.round(last.watts + drift)));
        const next: UsagePoint = {
          t: new Date().toISOString(),
          watts,
          gridState: grid.state,
        };
        return [...prev.slice(1), next];
      });
    }, 4000);
    return () => clearInterval(id);
  }, [reduced, grid.state]);

  const currentWatts = points.length ? points[points.length - 1].watts : 0;
  const c = gridColor[grid.state];
  const gradId = `live-fill-${grid.state}`;

  const { linePath, areaPath } = useMemo(() => buildPaths(points), [points]);

  return (
    <section aria-label="Live household usage">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sub">
            Running now
          </p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums text-ink">
              {currentWatts.toLocaleString()}
            </span>
            <span className="text-lg font-semibold text-sub">W</span>
          </p>
        </div>
        <p className="text-right text-sm">
          <span className={`font-semibold ${rateTone[grid.state]}`}>
            {grid.priceCents}¢
          </span>
          <span className="text-sub"> /kWh now</span>
        </p>
      </div>

      <svg
        role="img"
        aria-label={`Live usage, currently ${currentWatts} watts`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-3 h-auto w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.base} stopOpacity={0.28} />
            <stop offset="100%" stopColor={c.base} stopOpacity={0} />
          </linearGradient>
        </defs>

        {reduced ? (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={c.base}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <>
            <motion.path
              d={areaPath}
              fill={`url(#${gradId})`}
              animate={{ d: areaPath }}
              transition={{ duration: 0.6, ease }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke={c.base}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              animate={{ d: linePath }}
              transition={{ duration: 0.6, ease }}
            />
          </>
        )}
      </svg>
    </section>
  );
}

function buildPaths(points: UsagePoint[]): { linePath: string; areaPath: string } {
  if (points.length < 2) return { linePath: "", areaPath: "" };

  const watts = points.map((p) => p.watts);
  const min = Math.min(...watts);
  const max = Math.max(...watts);
  const span = Math.max(1, max - min);
  const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => (i / (points.length - 1)) * VIEW_W;
  const y = (w: number) => PAD_TOP + (1 - (w - min) / span) * usableH;

  const coords = points.map((p, i) => ({ x: x(i), y: y(p.watts) }));

  const line = coords
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
    .join(" ");

  const area =
    `M${coords[0].x.toFixed(2)},${VIEW_H} ` +
    `L${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)} ` +
    coords
      .slice(1)
      .map((pt) => `L${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
      .join(" ") +
    ` L${coords[coords.length - 1].x.toFixed(2)},${VIEW_H} Z`;

  return { linePath: line, areaPath: area };
}
