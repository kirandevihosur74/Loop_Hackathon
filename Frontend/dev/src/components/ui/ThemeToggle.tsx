"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { cn } from "@/lib/cn";

/**
 * Sun/moon day-night toggle. Circular (stays round per the radius rules).
 * Crossfades the icon on toggle; respects reduced motion.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const reduce = useReducedMotion();
  const isNight = theme === "night";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isNight ? "Switch to day mode" : "Switch to night mode"}
      aria-pressed={isNight}
      className={cn(
        "flex h-[38px] w-[38px] items-center justify-center rounded-pill bg-card text-ink shadow-soft",
        className,
      )}
    >
      <motion.span
        key={theme}
        initial={reduce ? false : { rotate: -30, opacity: 0, scale: 0.8 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex"
      >
        {isNight ? <MoonIcon /> : <SunIcon />}
      </motion.span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" fill="var(--gold)" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 12 + Math.cos(a) * 7.2;
        const y1 = 12 + Math.sin(a) * 7.2;
        const x2 = 12 + Math.cos(a) * 9.6;
        const y2 = 12 + Math.sin(a) * 9.6;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--gold)"
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
        fill="var(--gold)"
        stroke="var(--gold)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
