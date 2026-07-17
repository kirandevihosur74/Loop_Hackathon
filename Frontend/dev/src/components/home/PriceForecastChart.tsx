"use client";

/**
 * PriceForecastChart — Powerfly Home hero.
 * Weather-style electricity price forecast with a draggable time scrubber.
 *
 * Drag (pointer) or arrow-key the handle along the curve to read the price at any
 * hour; the handle snaps to the rendered curve. Warm-by-day / cool-by-night via
 * the `night` prop. Hand-rolled SVG (no chart lib).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PricePoint } from "@/lib/types";
import { ease } from "@/lib/motion";

const DEFAULT_DATA: PricePoint[] = [
  { hour: 0, cents: 14 },
  { hour: 3, cents: 9 },
  { hour: 6, cents: 15 },
  { hour: 9, cents: 17 },
  { hour: 12, cents: 11 },
  { hour: 14, cents: 18 },
  { hour: 16, cents: 26 },
  { hour: 17, cents: 34 },
  { hour: 19, cents: 30 },
  { hour: 22, cents: 16 },
  { hour: 24, cents: 14 },
];

// chart geometry (viewBox units)
const W = 358,
  YT = 14,
  YB = 132,
  PMIN = 6,
  PMAX = 36;
const xOf = (h: number) => (h / 24) * W;
const yOf = (c: number) => YB - ((c - PMIN) / (PMAX - PMIN)) * (YB - YT);

// price → state
function stateOf(c: number) {
  if (c < 15) return { key: "Cheap", color: "#F6C544" };
  if (c < 28) return { key: "Medium", color: "#EC8B2E" };
  return { key: "Peak", color: "#C24B2E" };
}

function centsAt(data: PricePoint[], h: number) {
  h = Math.max(0, Math.min(24, h));
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i],
      b = data[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour || 1);
      return a.cents + (b.cents - a.cents) * t;
    }
  }
  return data[data.length - 1].cents;
}

function fmtHour(h: number) {
  const hr = Math.round(h) % 24;
  const ap = hr >= 12 ? "pm" : "am";
  let d = hr % 12;
  if (d === 0) d = 12;
  return `${d}${ap}`;
}

// Catmull-Rom -> smooth cubic bezier path through points
function smoothPath(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6,
      c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6,
      c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// find y on a rendered <path> at a given x (path is monotonic in x)
function yAtX(path: SVGPathElement, targetX: number) {
  const total = path.getTotalLength();
  let lo = 0,
    hi = total;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const p = path.getPointAtLength(mid);
    if (p.x < targetX) lo = mid;
    else hi = mid;
  }
  return path.getPointAtLength((lo + hi) / 2).y;
}

export default function PriceForecastChart({
  data = DEFAULT_DATA,
  nowHour = 14.5,
  night = false,
}: {
  data?: PricePoint[];
  nowHour?: number;
  night?: boolean;
}) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dragging = useRef(false);

  const [hour, setHour] = useState(nowHour);
  const [scrubbed, setScrubbed] = useState(false);
  const [handle, setHandle] = useState({ x: xOf(nowHour), y: 0 });

  const { line, area, peak, low } = useMemo(() => {
    const pts = data.map((p) => [xOf(p.hour), yOf(p.cents)] as [number, number]);
    const l = smoothPath(pts);
    const pk = data.reduce((m, p) => (p.cents > m.cents ? p : m), data[0]);
    const lw = data.reduce((m, p) => (p.cents < m.cents ? p : m), data[0]);
    return { line: l, area: `${l} L${W},${YB} L0,${YB} Z`, peak: pk, low: lw };
  }, [data]);

  // place the handle dot exactly on the drawn curve whenever hour changes
  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const x = xOf(hour);
    setHandle({ x, y: yAtX(p, x) });
  }, [hour, line]);

  const moveTo = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    let h = Math.round((vx / W) * 24);
    h = Math.max(0, Math.min(24, h));
    setHour(h);
    setScrubbed(true);
  };

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) moveTo(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setHour((h) => Math.max(0, Math.round(h) - 1));
      setScrubbed(true);
    }
    if (e.key === "ArrowRight") {
      setHour((h) => Math.min(24, Math.round(h) + 1));
      setScrubbed(true);
    }
  };

  const cents = centsAt(data, hour);
  const st = stateOf(cents);

  // Night is now a LIGHT (cool) theme — no dark surface. Only the hero gradient,
  // text tone and accent shift cool; the price curve + peak/cheap dots stay warm.
  const heroBg = night
    ? "linear-gradient(180deg,#EAF2F7 0%,#DCEAF2 55%,#CDE0EC 100%)"
    : "linear-gradient(180deg,#FDF3E0 0%,#FBE7C4 55%,#F7D9A6 100%)";
  const ink = night ? "#23201C" : "#2A2620";
  const sub = night ? "#7E8894" : "#8C8375";
  const goldD = night ? "#2E6C93" : "#D07E1B";

  return (
    <div
      className="rounded-[11px] p-4 pb-2 shadow-soft select-none"
      style={{ background: heroBg }}
    >
      {/* header row */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-[11px] font-extrabold uppercase tracking-wide"
          style={{ color: goldD }}
        >
          Today&apos;s electricity
        </span>
        <span className="ml-auto flex items-center gap-1">{night ? <MoonIcon /> : <SunIcon />}</span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-[42px] font-extrabold leading-none tracking-tight tabular-nums"
          style={{ color: ink }}
        >
          {Math.round(cents)}¢
        </span>
        <span className="text-[15px] font-semibold" style={{ color: sub }}>
          {scrubbed ? `/kWh at ${fmtHour(hour)}` : "/kWh now"}
        </span>
        <span
          className="ml-auto rounded-[11px] px-3 py-1 text-[11px] font-extrabold text-white"
          style={{ background: st.color }}
        >
          {st.key}
        </span>
      </div>

      <div
        className="mt-0.5 flex items-center gap-4 text-[11px] font-extrabold"
        style={{ color: goldD }}
      >
        <span>
          ▲ Peak {peak.cents}¢ · {fmtHour(peak.hour)}
        </span>
        <span>
          ▼ Cheapest {low.cents}¢ · {fmtHour(low.hour)}
        </span>
        {scrubbed && (
          <button
            onClick={() => {
              setHour(nowHour);
              setScrubbed(false);
            }}
            className="ml-auto rounded-[11px] bg-white/90 px-2.5 py-1 text-[11px] font-extrabold"
            style={{ color: goldD }}
          >
            Now
          </button>
        )}
      </div>

      {/* chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} 172`}
        preserveAspectRatio="none"
        className="mt-1.5 block h-[158px] w-full cursor-ew-resize focus:outline-none focus-visible:[outline:2px_solid_var(--gold)] focus-visible:[outline-offset:3px]"
        style={{ touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="slider"
        aria-label="Scrub electricity price by time of day"
        aria-valuemin={0}
        aria-valuemax={24}
        aria-valuenow={Math.round(hour)}
        aria-valuetext={`${fmtHour(hour)}, ${Math.round(cents)} cents`}
        tabIndex={0}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EC8B2E" stopOpacity="0.38" />
            <stop offset="1" stopColor="#F6C544" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="pf-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F6C544" />
            <stop offset="0.62" stopColor="#EF9A31" />
            <stop offset="1" stopColor="#C24B2E" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#pf-fill)" />

        {/* markers: sun over cheap dip, bolt at peak */}
        <g fill="#E9A93A">
          <circle cx={xOf(low.hour)} cy={42} r={7} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={xOf(low.hour) + Math.cos(r) * 10}
                y1={42 + Math.sin(r) * 10}
                x2={xOf(low.hour) + Math.cos(r) * 14}
                y2={42 + Math.sin(r) * 14}
                stroke="#E9A93A"
                strokeWidth={2}
              />
            );
          })}
        </g>
        <polygon
          points={`${xOf(peak.hour) - 3},20 ${xOf(peak.hour) + 3},20 ${xOf(peak.hour) - 1},28 ${xOf(peak.hour) + 4},28 ${xOf(peak.hour) - 4},38 ${xOf(peak.hour) - 1},29 ${xOf(peak.hour) - 5},29`}
          fill="#C24B2E"
        />

        {/* scrubber line */}
        <line
          x1={handle.x}
          y1={YT - 2}
          x2={handle.x}
          y2={YB}
          stroke={goldD}
          strokeWidth={1.5}
          strokeDasharray="2 4"
          opacity={0.8}
        />

        {/* the curve — draws in left→right once on first mount (scrubbing never
            re-triggers it: `d` is static, only the handle moves) */}
        <motion.path
          ref={pathRef}
          d={line}
          fill="none"
          stroke="url(#pf-stroke)"
          strokeWidth={3.5}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease }}
        />

        {/* peak / cheapest dots + labels */}
        <circle cx={xOf(peak.hour)} cy={yOf(peak.cents)} r={4.5} fill="#C24B2E" />
        <text
          x={xOf(peak.hour)}
          y={yOf(peak.cents) - 9}
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="#C24B2E"
        >
          {peak.cents}¢
        </text>
        <circle cx={xOf(low.hour)} cy={yOf(low.cents)} r={4.5} fill="#E0A93A" />
        <text
          x={xOf(low.hour)}
          y={yOf(low.cents) + 18}
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill={goldD}
        >
          {low.cents}¢
        </text>

        {/* draggable handle — softly pulses while it marks "now" (static once
            scrubbed or under reduced motion) */}
        <motion.circle
          cx={handle.x}
          cy={handle.y}
          r={7}
          fill="#fff"
          stroke="#EF9A31"
          strokeWidth={3}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={
            !scrubbed && !reduced
              ? { scale: [1, 1.15, 1], opacity: [1, 0.85, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={
            !scrubbed && !reduced
              ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        />
        <text
          x={handle.x + (handle.x > W - 40 ? -10 : 8)}
          y={handle.y - 9}
          textAnchor={handle.x > W - 40 ? "end" : "start"}
          fontSize="12"
          fontWeight="800"
          fill={ink}
        >
          {scrubbed ? fmtHour(hour) : "now"}
        </text>
      </svg>

      {/* x-axis */}
      <div
        className="flex justify-between px-1 pt-0.5 pb-1 text-[10px] font-semibold"
        style={{ color: sub }}
      >
        <span>12AM</span>
        <span>6AM</span>
        <span>12PM</span>
        <span>6PM</span>
        <span>12AM</span>
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="5.5" fill="#F4C85B" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={13 + Math.cos(r) * 8}
            y1={13 + Math.sin(r) * 8}
            x2={13 + Math.cos(r) * 11}
            y2={13 + Math.sin(r) * 11}
            stroke="#F4C85B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path
        d="M17 15.5A7 7 0 0 1 9.2 6a7 7 0 1 0 9.6 9.6 7.1 7.1 0 0 1-1.8-.1Z"
        fill="#E9D9A6"
      />
    </svg>
  );
}
