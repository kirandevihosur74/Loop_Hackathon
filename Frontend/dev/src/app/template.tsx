"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";

/**
 * App Router template — re-mounts on every route change, so it's the natural
 * home for the page-enter transition: a quick fade + 4px slide up. Respects
 * prefers-reduced-motion (fade only, no slide).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease }}
    >
      {children}
    </motion.div>
  );
}
