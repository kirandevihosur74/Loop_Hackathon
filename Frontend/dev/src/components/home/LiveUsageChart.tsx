"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GridState, UsagePoint } from "@/lib/types";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";

const VIEW_W = 340;
const VIEW_H = 132;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;

/** Rate figure tone, mapped from the grid price ramp (gold / orange / rust). */
const rateTone: Record<GridState, string> = {
  cheap: "text-gold",
  medium: "text-medium",
  expensive: "text-peak",
};

/** Theme-aware price-ramp color per grid state (follows day/night via CSS vars). */
const rampVar: Record<GridState, string> = {
  cheap: cssVar.cheap,
  medium: cssVar.medium,
  expensive: cssVar.peak,
};

/**
 * The "Running now" centerpiece: a hand-rolled SVG live area chart of household
 * watts, read as a weather-style price/usage curve. A gold dot + "Running now" +
 * big current-watts number sit above it. Area + smooth line are colored by the
 * current grid state (theme-aware cssVar), with a dashed "now" vertical and a
 * white now-dot at the leading edge. Every ~4s we append a new eased point; the
 * interval is cleared on unmount and skipped under reduced motion.
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
  const stroke = rampVar[grid.state];
  const gradId = `live-fill-${grid.state}`;

  const { linePath, areaPath, nowPoint } = useMemo(() => buildPaths(points), [points]);

  return (
    <section aria-label="Live household usage">
      <div className="flex items-end justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sub">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
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
            <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>

        {reduced ? (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <>
            <motion.path
              fill={`url(#${gradId})`}
              initial={false}
              animate={{ d: areaPath }}
              transition={{ duration: 0.6, ease }}
            />
            <motion.path
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={false}
              animate={{ d: linePath }}
              transition={{ duration: 0.6, ease }}
            />
          </>
        )}

        {/* Dashed "now" vertical + white now-dot at the leading edge. */}
        {nowPoint ? (
          <>
            <line
              x1={nowPoint.x}
              y1={0}
              x2={nowPoint.x}
              y2={VIEW_H}
              stroke={cssVar.sub}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity={0.6}
            />
            <circle cx={nowPoint.x} cy={nowPoint.y} r={4.5} fill={cssVar.card} />
            <circle
              cx={nowPoint.x}
              cy={nowPoint.y}
              r={4.5}
              fill="none"
              stroke={cssVar.gold}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>
    </section>
  );
}

function buildPaths(points: UsagePoint[]): {
  linePath: string;
  areaPath: string;
  nowPoint: { x: number; y: number } | null;
} {
  if (points.length < 2) return { linePath: "", areaPath: "", nowPoint: null };

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

  return { linePath: line, areaPath: area, nowPoint: coords[coords.length - 1] };
}
