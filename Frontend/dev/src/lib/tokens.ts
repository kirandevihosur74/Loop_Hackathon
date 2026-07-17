/**
 * Raw token values for contexts that cannot read Tailwind classes —
 * hand-rolled SVG charts, inline `fill`/`stroke`, canvas, framer-motion colors.
 * These are the DAY values and MUST stay in sync with the @theme block in
 * src/app/globals.css. For theme-aware SVG, prefer `var(--gold)`, `var(--peak)`,
 * etc. directly in `fill`/`stroke`; use these constants when a literal is needed.
 */

import type { GridState, Confidence } from "@/lib/types";

export const color = {
  /* brand gold */
  gold: "#EF9A31",
  goldDeep: "#D07E1B",
  goldTint: "#FCEBCF",

  /* price ramp */
  cheap: "#F6C544",
  cheapTint: "#FCEFC7",
  medium: "#EC8B2E",
  mediumTint: "#FBE7CF",
  peak: "#C24B2E",
  peakTint: "#F6E0D6",

  /* neutrals */
  ink: "#2A2620",
  sub: "#8C8375",
  line: "#EFE7DA",
  bg: "#FBF7F0",
  card: "#FFFFFF",

  /* back-compat aliases (old green/amber/red names → warm). Prefer the names
     above in new code; these keep pre-redesign chart code compiling + warm. */
  green: "#EF9A31",
  greenLight: "#FCEBCF",
  greenDeep: "#D07E1B",
  amber: "#EC8B2E",
  amberLight: "#FBE7CF",
  red: "#C24B2E",
  redLight: "#F6E0D6",
} as const;

/** CSS variable references — use these in SVG fill/stroke to stay theme-aware. */
export const cssVar = {
  gold: "var(--gold)",
  goldDeep: "var(--gold-d)",
  goldTint: "var(--gold-l)",
  cheap: "var(--cheap)",
  medium: "var(--medium)",
  peak: "var(--peak)",
  ink: "var(--ink)",
  sub: "var(--sub)",
  line: "var(--line)",
  card: "var(--card)",
} as const;

export const radius = {
  sm: 8,
  md: 11,
  lg: 11,
  pill: 999,
} as const;

/** Grid price state → its color set (price heat-ramp). Yellow cheap → orange → rust peak. */
export const gridColor: Record<GridState, { base: string; light: string; deep: string }> = {
  cheap: { base: color.cheap, light: color.cheapTint, deep: color.goldDeep },
  medium: { base: color.medium, light: color.mediumTint, deep: color.medium },
  expensive: { base: color.peak, light: color.peakTint, deep: color.peak },
};

/** Human labels for grid state. */
export const gridLabel: Record<GridState, string> = {
  cheap: "Cheap",
  medium: "Medium",
  expensive: "Peak",
};

/** Confidence is always a Low / Med / High band — never a fake percentage. */
export const confidenceLabel: Record<Confidence, string> = {
  low: "Low",
  med: "Med",
  high: "High",
};
