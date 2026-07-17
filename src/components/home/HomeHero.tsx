"use client";

import { useState } from "react";
import Image from "next/image";
import type { GridState } from "@/lib/types";
import { GridStateBadge } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Set to true once /public/home-day.png & /public/home-night.png exist.
 * Until then the CSS sky gradient below IS the hero, and the <Image> slots
 * are wired up but never render (so they can't 404).
 */
const HAS_HERO_IMAGES = false;

type Mode = "day" | "night";

/**
 * Full-bleed hero with a calm address header + a day/night sun/moon toggle.
 * The hero cross-fades between a warm day sky and a deep-blue night sky — the
 * ONE sanctioned exception to the color vocabulary, kept entirely inside here.
 * A small GridStateBadge overlays the current grid price.
 */
export function HomeHero({
  grid,
}: {
  grid: { state: GridState; priceCents: number };
}) {
  const [mode, setMode] = useState<Mode>("day");
  const isDay = mode === "day";

  return (
    <header>
      {/* Calm address row + day/night toggle */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">123 Maple St</p>
          <p className="truncate text-xs text-sub">San Jose</p>
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "day" ? "night" : "day"))}
          aria-label={isDay ? "Switch to night view" : "Switch to day view"}
          aria-pressed={!isDay}
          className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-card text-ink shadow-soft ring-1 ring-line transition-[transform,color] active:scale-[0.96] hover:text-sub"
        >
          {isDay ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      {/* Full-bleed sky hero — rounded BOTTOM, edge-to-edge in the phone column. */}
      <div className="relative mt-3 h-56 overflow-hidden rounded-b-lg">
        {/* Day sky layer */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-out",
            isDay ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "linear-gradient(180deg, #7FB6E6 0%, #A9D0EC 38%, #E7D9B4 78%, #F6E2B8 100%)",
          }}
          aria-hidden
        >
          <Celestial kind="sun" />
        </div>

        {/* Night sky layer */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-out",
            isDay ? "opacity-0" : "opacity-100",
          )}
          style={{
            background:
              "linear-gradient(180deg, #0B1B36 0%, #142A4E 55%, #21375F 100%)",
          }}
          aria-hidden
        >
          <Stars />
          <Celestial kind="moon" />
        </div>

        {/* TODO: drop in home-day.png / home-night.png — wired up, disabled until they exist. */}
        {HAS_HERO_IMAGES && (
          <Image
            src={isDay ? "/home-day.png" : "/home-night.png"}
            alt=""
            fill
            sizes="430px"
            style={{ objectFit: "cover" }}
            className="pointer-events-none select-none"
          />
        )}

        {/* Grid state overlay */}
        <div className="absolute left-4 top-4">
          <GridStateBadge state={grid.state} priceCents={grid.priceCents} />
        </div>
      </div>
    </header>
  );
}

/** Warm sun / pale moon disc — decorative, sky-exception colors only. */
function Celestial({ kind }: { kind: "sun" | "moon" }) {
  const isSun = kind === "sun";
  return (
    <div
      className="absolute right-8 top-8 h-16 w-16 rounded-pill"
      style={{
        background: isSun
          ? "radial-gradient(circle at 50% 45%, #FFF1C4 0%, #FFD873 45%, #FBB944 100%)"
          : "radial-gradient(circle at 42% 40%, #F3F6FB 0%, #D7DFEC 60%, #B9C4D6 100%)",
        boxShadow: isSun
          ? "0 0 40px 14px rgba(255, 210, 110, 0.55)"
          : "0 0 28px 8px rgba(210, 224, 245, 0.35)",
      }}
      aria-hidden
    />
  );
}

/** A few faint night stars. */
function Stars() {
  const stars = [
    { top: "18%", left: "16%", s: 2 },
    { top: "30%", left: "62%", s: 1.5 },
    { top: "22%", left: "78%", s: 2.5 },
    { top: "48%", left: "28%", s: 1.5 },
    { top: "40%", left: "46%", s: 2 },
    { top: "60%", left: "70%", s: 1.5 },
  ];
  return (
    <>
      {stars.map((st, i) => (
        <span
          key={i}
          className="absolute rounded-pill"
          style={{
            top: st.top,
            left: st.left,
            width: st.s,
            height: st.s,
            background: "#F3F6FB",
            opacity: 0.85,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 12 + Math.cos(a) * 7;
        const y1 = 12 + Math.sin(a) * 7;
        const x2 = 12 + Math.cos(a) * 9.5;
        const y2 = 12 + Math.sin(a) * 9.5;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
