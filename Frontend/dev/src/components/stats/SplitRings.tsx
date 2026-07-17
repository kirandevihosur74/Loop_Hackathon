"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { SplitUsage } from "@/lib/types";
import { color } from "@/lib/tokens";
import { ease } from "@/lib/motion";

function MiniRing({
  label,
  usage,
  fraction,
  stroke,
  track,
}: {
  label: string;
  usage: SplitUsage;
  fraction: number;
  stroke: string;
  track: string;
}) {
  const reduce = useReducedMotion();
  const size = 108;
  const strokeW = 11;
  const r = (size - strokeW) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = circumference * (1 - clamped);
  const pct = Math.round(clamped * 100);

  return (
    <div className="flex flex-1 flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-24 h-24"
        role="img"
        aria-label={`${label}: ${usage.kwh} kilowatt hours, $${usage.costUsd.toFixed(
          2,
        )} — ${pct}% of your energy.`}
      >
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={strokeW} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${c} ${c})`}
          initial={{ strokeDashoffset: reduce ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease }}
        />
        <text x={c} y={c + 5} textAnchor="middle" fontSize="22" fontWeight="700" fill={color.ink}>
          {pct}%
        </text>
      </svg>
      <div className="mt-1 text-sm font-semibold text-ink">{label}</div>
      <div className="text-xs tabular-nums text-sub">
        {usage.kwh} kWh · ${usage.costUsd.toFixed(2)}
      </div>
    </div>
  );
}

/** Two mini rings — Home vs Car — each sized to its share of total energy. */
export function SplitRings({ home, car }: { home: SplitUsage; car: SplitUsage }) {
  const total = home.kwh + car.kwh || 1;
  return (
    <div className="flex items-start gap-4">
      <MiniRing
        label="Home"
        usage={home}
        fraction={home.kwh / total}
        stroke={color.green}
        track={color.greenLight}
      />
      <MiniRing
        label="Car"
        usage={car}
        fraction={car.kwh / total}
        stroke={color.amber}
        track={color.amberLight}
      />
    </div>
  );
}
