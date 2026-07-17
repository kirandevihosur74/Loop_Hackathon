/**
 * Shared framer-motion variants + easing so every screen animates with one voice.
 * All non-essential motion must be gated on `prefers-reduced-motion` — use the
 * `useReducedMotion` hook from framer-motion in components and fall back to the
 * `noMotion` variants below.
 */

import type { Transition, Variants } from "framer-motion";

/** iOS-ish soft ease. */
export const ease = [0.22, 1, 0.36, 1] as const;

export const springSoft: Transition = { type: "spring", stiffness: 320, damping: 30 };

/** Card / section gentle enter. */
export const enter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease } },
};

/** Staggered list container (agent checklist, advice items). */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

/** A single row revealing as its check completes. */
export const staggerRow: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
};

/** Reduced-motion fallback — appears instantly, no transform. */
export const noMotion: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};
