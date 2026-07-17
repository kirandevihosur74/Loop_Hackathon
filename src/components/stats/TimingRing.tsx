"use client";

import { motion, useReducedMotion } from "framer-motion";
import { color } from "@/lib/tokens";
import { ease } from "@/lib/motion";

/** Score at/above which the ring reads as "good" (green) vs. "could do better" (amber). */
const GOOD_THRESHOLD = 60;

/**
 * Hero ring for the timing score — the % of power used during cheap / clean hours.
 * Stroke is green when the score is high, amber when lower. The sweep animates in
 * (skipped when the user prefers reduced motion).
 */
export function TimingRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const good = clamped >= GOOD_THRESHOLD;
  const stroke = good ? color.green : color.amber;
  const track = good ? color.greenLight : color.amberLight;

  const size = 200;
  const strokeW = 16;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-44 h-44"
        role="img"
        aria-label={`Timing score: ${clamped}% of your power used during cheap, clean hours.`}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={strokeW} />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDashoffset: reduce ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="44"
          fontWeight="700"
          fill={color.ink}
        >
          {clamped}%
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="13" fill={color.sub}>
          cheap / clean
        </text>
      </svg>
    </div>
  );
}
