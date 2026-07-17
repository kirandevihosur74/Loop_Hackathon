"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { GridState } from "@/lib/types";
import { GridStateBadge, ThemeToggle } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";

const CURVE_W = 320;
const CURVE_H = 96;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;

/** A day-long price-forecast curve (mocked locally — no data-layer change). */
const FORECAST: { h: number; c: number }[] = [
  { h: 0, c: 14 },
  { h: 2, c: 12 },
  { h: 4, c: 11 },
  { h: 6, c: 13 },
  { h: 8, c: 16 },
  { h: 10, c: 10 },
  { h: 12, c: 9 },
  { h: 14, c: 15 },
  { h: 16, c: 24 },
  { h: 18, c: 34 },
  { h: 20, c: 28 },
  { h: 22, c: 18 },
  { h: 24, c: 14 },
];

/**
 * Warm price-"weather" hero. A calm address header (with the app-wide ThemeToggle)
 * sits above a full-bleed panel on the --hero-1/2/3 sky gradient (peach by day →
 * deep blue by night, driven entirely by the theme CSS vars). Inside: today's rate,
 * a grid-state badge, peak/cheapest chips, a smooth price-forecast curve with a
 * dashed "now" line, and a sun (day) that cross-fades to a moon (night) via useTheme().
 */
export function HomeHero({
  grid,
}: {
  grid: { state: GridState; priceCents: number };
}) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const isNight = theme === "night";

  const { linePath, areaPath, nowX, peak, low } = useMemo(() => buildForecast(), []);

  return (
    <header>
      {/* Calm address row + app-wide day/night toggle. */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">123 Maple St</p>
          <p className="truncate text-xs text-sub">San Jose</p>
        </div>
        <ThemeToggle className="h-11 w-11 ring-1 ring-line" />
      </div>

      {/* Full-bleed sky hero — warm→cool via --hero vars, rounded BOTTOM (5px). */}
      <div
        className="relative mt-3 overflow-hidden rounded-b-lg px-4 pb-3 pt-4 shadow-soft"
        style={{
          background:
            "linear-gradient(180deg, var(--hero-1), var(--hero-2) 55%, var(--hero-3))",
        }}
      >
        {/* Sun (day) ↔ moon (night) — cross-fades with the theme. */}
        <div className="pointer-events-none absolute right-5 top-4 h-14 w-14">
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={theme}
              className="absolute inset-0"
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.6, ease }}
            >
              <Celestial kind={isNight ? "moon" : "sun"} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rate + grid state */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-deep">
              Today&apos;s electricity
            </p>
            <p className="mt-1 flex items-baseline gap-1">
              <span
                className="font-bold tabular-nums leading-none text-ink"
                style={{ fontSize: 42 }}
              >
                {grid.priceCents}¢
              </span>
              <span className="text-sm font-medium text-sub">/kWh now</span>
            </p>
          </div>
          <GridStateBadge state={grid.state} priceCents={grid.priceCents} />
        </div>

        {/* Peak / cheapest chips */}
        <div className="relative mt-3 flex flex-wrap gap-2">
          <Chip>▲ Peak 5–8pm · {peak.c}¢</Chip>
          <Chip>▼ Cheapest 12pm · {low.c}¢</Chip>
        </div>

        {/* Price-forecast curve for the day */}
        <div className="relative mt-3">
          <svg
            role="img"
            aria-label="Today's electricity price forecast"
            viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
            className="h-auto w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="hero-price-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={cssVar.cheap} />
                <stop offset="55%" stopColor={cssVar.gold} />
                <stop offset="100%" stopColor={cssVar.peak} />
              </linearGradient>
              <linearGradient id="hero-price-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cssVar.gold} stopOpacity={0.26} />
                <stop offset="100%" stopColor={cssVar.gold} stopOpacity={0} />
              </linearGradient>
            </defs>

            <path d={areaPath} fill="url(#hero-price-area)" />
            <path
              d={linePath}
              fill="none"
              stroke="url(#hero-price-line)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Dashed "now" vertical */}
            <line
              x1={nowX}
              y1={PAD_TOP - 6}
              x2={nowX}
              y2={CURVE_H}
              stroke={cssVar.sub}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity={0.7}
            />

            {/* Peak dot */}
            <circle cx={peak.x} cy={peak.y} r={3.5} fill={cssVar.peak} />
            {/* Cheapest dot */}
            <circle cx={low.x} cy={low.y} r={3.5} fill={cssVar.cheap} />
          </svg>

          {/* Peak / low value labels, positioned over the curve */}
          <span
            className="absolute -translate-x-1/2 -translate-y-full text-[10px] font-bold tabular-nums text-peak"
            style={{ left: `${(peak.x / CURVE_W) * 100}%`, top: `${(peak.y / CURVE_H) * 100}%` }}
          >
            {peak.c}¢
          </span>
          <span
            className="absolute -translate-x-1/2 translate-y-1 text-[10px] font-bold tabular-nums text-gold-deep"
            style={{ left: `${(low.x / CURVE_W) * 100}%`, top: `${(low.y / CURVE_H) * 100}%` }}
          >
            {low.c}¢
          </span>

          {/* Axis */}
          <div className="mt-1 flex justify-between text-[10px] font-medium tabular-nums text-sub">
            <span>12AM</span>
            <span>6AM</span>
            <span>12PM</span>
            <span>6PM</span>
            <span>12AM</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-card/75 px-2.5 py-1 text-xs font-semibold text-gold-deep shadow-soft ring-1 ring-line/50 backdrop-blur-sm">
      {children}
    </span>
  );
}

/** Build the smooth forecast path + peak/low/now markers from FORECAST. */
function buildForecast() {
  const cents = FORECAST.map((p) => p.c);
  const min = Math.min(...cents);
  const max = Math.max(...cents);
  const span = Math.max(1, max - min);
  const usableH = CURVE_H - PAD_TOP - PAD_BOTTOM;

  const x = (h: number) => (h / 24) * CURVE_W;
  const y = (c: number) => PAD_TOP + (1 - (c - min) / span) * usableH;

  const coords = FORECAST.map((p) => ({ x: x(p.h), y: y(p.c), c: p.c }));

  const linePath = smoothPath(coords);
  const areaPath =
    `M${coords[0].x.toFixed(2)},${CURVE_H} L${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)} ` +
    smoothPath(coords).replace(/^M[^ ]+ /, "") +
    ` L${coords[coords.length - 1].x.toFixed(2)},${CURVE_H} Z`;

  const peakIdx = cents.indexOf(max);
  const lowIdx = cents.indexOf(min);

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowX = x(nowHour);

  return {
    linePath,
    areaPath,
    nowX,
    peak: coords[peakIdx],
    low: coords[lowIdx],
  };
}

/** Catmull-Rom → cubic bezier for a smooth curve through the points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Warm sun / pale moon disc — decorative celestial glyph. Its own radial-gradient
 * hexes are the ONE sanctioned color exception, kept entirely inside HomeHero.
 */
function Celestial({ kind }: { kind: "sun" | "moon" }) {
  const isSun = kind === "sun";
  return (
    <div
      className="h-full w-full rounded-full"
      style={{
        background: isSun
          ? "radial-gradient(circle at 50% 45%, #FFF1C4 0%, #FFD873 45%, #FBB944 100%)"
          : "radial-gradient(circle at 42% 40%, #F3F6FB 0%, #D7DFEC 60%, #B9C4D6 100%)",
        boxShadow: isSun
          ? "0 0 40px 14px rgba(255, 210, 110, 0.5)"
          : "0 0 26px 8px rgba(210, 224, 245, 0.32)",
      }}
      aria-hidden
    />
  );
}
