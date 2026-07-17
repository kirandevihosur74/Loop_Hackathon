"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HourUsage } from "@/lib/types";
import { color, gridColor, gridLabel } from "@/lib/tokens";
import { ease } from "@/lib/motion";

/** Format an hour (0–23) as a compact clock label like "6a" / "12p". */
function hourLabel(h: number): string {
  const suffix = h < 12 ? "a" : "p";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

/**
 * 24-bar chart of hourly kWh, each bar tinted by that hour's grid price
 * (green cheap / amber medium / red peak) — "when you used vs. when it was cheap".
 */
export function HourlyBars({ hourly }: { hourly: HourUsage[] }) {
  const reduce = useReducedMotion();

  const width = 336;
  const chartH = 120;
  const labelH = 16;
  const height = chartH + labelH;
  const n = hourly.length || 24;
  const gap = 3;
  const barW = (width - gap * (n - 1)) / n;
  const maxKwh = Math.max(...hourly.map((h) => h.kwh), 0.1);

  const cheapKwh = hourly
    .filter((h) => h.gridState === "cheap")
    .reduce((s, h) => s + h.kwh, 0);
  const totalKwh = hourly.reduce((s, h) => s + h.kwh, 0);
  const summary = `Hourly electricity use across the day. ${
    totalKwh > 0 ? Math.round((cheapKwh / totalKwh) * 100) : 0
  }% of it fell in cheap hours. Peak use around ${
    hourLabel(hourly.reduce((best, h) => (h.kwh > best.kwh ? h : best), hourly[0] ?? { hour: 0, kwh: 0 }).hour)
  }.`;

  const ticks = [0, 6, 12, 18];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={summary}
      >
        {hourly.map((h, i) => {
          const barH = Math.max(2, (h.kwh / maxKwh) * chartH);
          const x = i * (barW + gap);
          const y = chartH - barH;
          return (
            <motion.rect
              key={h.hour}
              x={x}
              width={barW}
              rx={2}
              fill={gridColor[h.gridState].base}
              initial={reduce ? { y, height: barH } : { y: chartH, height: 0 }}
              animate={{ y, height: barH }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, delay: i * 0.012, ease }}
            >
              <title>{`${hourLabel(h.hour)} · ${h.kwh} kWh · ${gridLabel[h.gridState]}`}</title>
            </motion.rect>
          );
        })}
        {ticks.map((t) => {
          const x = t * (barW + gap) + barW / 2;
          return (
            <text
              key={t}
              x={x}
              y={height - 3}
              textAnchor="middle"
              fontSize="10"
              fill={color.sub}
            >
              {hourLabel(t)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(["cheap", "medium", "expensive"] as const).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5 text-xs text-sub">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: gridColor[g].base }}
              aria-hidden
            />
            {gridLabel[g]}
          </span>
        ))}
      </div>
    </div>
  );
}
