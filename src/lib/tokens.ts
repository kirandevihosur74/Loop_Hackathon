/**
 * Raw token values for contexts that cannot read Tailwind classes —
 * hand-rolled SVG charts, inline `fill`/`stroke`, canvas, framer-motion colors.
 * These MUST stay in sync with the @theme block in src/app/globals.css.
 */

import type { GridState, Confidence } from "@/lib/types";

export const color = {
  green: "#4E8C57",
  greenLight: "#E4F0E6",
  greenDeep: "#3C6E44",
  amber: "#C88A22",
  amberLight: "#F6ECD6",
  red: "#C2544B",
  redLight: "#F5E1DE",
  ink: "#23272B",
  sub: "#7C858C",
  line: "#E9EDEA",
  bg: "#EEF2EF",
  card: "#FFFFFF",
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Grid price state → its semantic color set. Green cheap, amber medium, red expensive. */
export const gridColor: Record<GridState, { base: string; light: string; deep: string }> = {
  cheap: { base: color.green, light: color.greenLight, deep: color.greenDeep },
  medium: { base: color.amber, light: color.amberLight, deep: color.amber },
  expensive: { base: color.red, light: color.redLight, deep: color.red },
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
