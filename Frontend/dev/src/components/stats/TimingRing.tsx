"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";

/**
 * Hero ring for the timing score — the % of power used during cheap / clean hours.
 * The arc is always the brand gold on a neutral track; the sweep animates from
 * 0 → value when the ring scrolls into view (skipped when the user prefers
 * reduced motion). Theme-aware via cssVar.
 */
export function TimingRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = cssVar.gold;
  const track = cssVar.line;

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
        ref={ref}
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
          initial={false}
          animate={{
            strokeDashoffset: reduce ? offset : inView ? offset : circumference,
          }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="44"
          fontWeight="700"
          fill={cssVar.ink}
        >
          {clamped}%
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="13" fill={cssVar.sub}>
          cheap / clean
        </text>
      </svg>
    </div>
  );
}
