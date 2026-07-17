"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import { cssVar } from "@/lib/tokens";

/**
 * The mascot — a calm peach/yellow SVG butterfly. When the agent is working, the
 * wings flutter (a quick wing-flap ~180ms) over a soft hover-bob, and gold
 * concentric rings pulse outward behind it like a gentle radar ("thinking").
 * Idle: a slow bob + a barely-there wing breathe. Reduced motion: a static
 * butterfly — no flutter, no bob, no rings. Information is never gated on motion.
 */

/** Soft pulsing concentric rings — a "thinking" radar, gold, only while working. */
function PulseRings() {
  const rings = [0, 0.55, 1.1];
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {rings.map((delay, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ height: 104, width: 104, border: `1.5px solid ${cssVar.gold}` }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.9], opacity: [0.35, 0] }}
          transition={{ duration: 1.7, ease, repeat: Infinity, delay }}
        />
      ))}
    </div>
  );
}

export function Butterfly({ working }: { working: boolean }) {
  const reduce = useReducedMotion();

  // Whole-body bob: quicker + smaller while working, slow drift when idle.
  const bob = reduce ? { y: 0 } : { y: working ? [0, -5, 0] : [0, -8, 0] };
  const bobTransition = reduce
    ? { duration: 0.3, ease }
    : { duration: working ? 2.2 : 3.2, ease, repeat: Infinity };

  // Wing flap: rapid flutter while working (~180ms/beat), gentle breathe when idle.
  const wingAnim = reduce ? { scaleX: 1 } : { scaleX: working ? [1, 0.64, 1] : [1, 0.95, 1] };
  const wingTransition = reduce
    ? { duration: 0 }
    : working
      ? { duration: 0.28, ease: "easeInOut" as const, repeat: Infinity }
      : { duration: 3.4, ease: "easeInOut" as const, repeat: Infinity };

  // Wings pivot around the body's vertical axis (x=60 in the viewBox).
  const wingStyle = { transformBox: "view-box" as const, transformOrigin: "60px 50px" };

  return (
    <div className="relative flex justify-center">
      {!reduce && working && <PulseRings />}

      <motion.div
        className="relative z-[1] h-40 w-40"
        animate={bob}
        transition={bobTransition}
      >
        <svg
          viewBox="0 0 120 96"
          className="h-full w-full"
          role="img"
          aria-label={working ? "Agent working" : "Agent watching"}
        >
          {/* Wings — flutter as one group around the body axis. */}
          <motion.g style={wingStyle} animate={wingAnim} transition={wingTransition}>
            <ellipse cx="44" cy="38" rx="26" ry="30" fill="#F0A98C" transform="rotate(-18 44 38)" />
            <ellipse cx="76" cy="38" rx="26" ry="30" fill="#F0A98C" transform="rotate(18 76 38)" />
            <ellipse cx="46" cy="66" rx="18" ry="22" fill="#F3B99F" transform="rotate(16 46 66)" />
            <ellipse cx="74" cy="66" rx="18" ry="22" fill="#F3B99F" transform="rotate(-16 74 66)" />
            <circle cx="44" cy="34" r="6" fill="#FBE7C6" />
            <circle cx="76" cy="34" r="6" fill="#FBE7C6" />
          </motion.g>

          {/* Body + face (static). */}
          <ellipse cx="60" cy="52" rx="7" ry="24" fill="#F6C544" />
          <circle cx="60" cy="26" r="7" fill="#F6C544" />
          <circle cx="57" cy="25" r="1.4" fill="#2A2620" />
          <circle cx="63" cy="25" r="1.4" fill="#2A2620" />
          <path d="M56 30 Q60 33 64 30" stroke="#2A2620" strokeWidth="1.4" fill="none" />
          <path d="M60 20 Q52 12 48 8" stroke="#2A2620" strokeWidth="1.6" fill="none" />
          <path d="M60 20 Q68 12 72 8" stroke="#2A2620" strokeWidth="1.6" fill="none" />
          <circle cx="48" cy="8" r="2" fill="#2A2620" />
          <circle cx="72" cy="8" r="2" fill="#2A2620" />
        </svg>
      </motion.div>
    </div>
  );
}
