"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import { cssVar } from "@/lib/tokens";

/**
 * The mascot — a calm peach/yellow butterfly. When the agent is working the
 * wings flutter (the looping video) over a soft hover-bob, and gold concentric
 * rings pulse outward behind it like a gentle radar ("thinking"). Idle: a slow
 * bob, rings gone, poster frame at rest. Reduced motion: a static butterfly with
 * no flutter, no bob, no rings — information is never gated behind motion.
 */

/** Soft pulsing concentric rings — a "thinking" radar, gold, only while working. */
function PulseRings() {
  const rings = [0, 0.55, 1.1];
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {rings.map((delay, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            height: 96,
            width: 96,
            border: `1.5px solid ${cssVar.gold}`,
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.9], opacity: [0.35, 0] }}
          transition={{
            duration: 1.7,
            ease,
            repeat: Infinity,
            delay,
          }}
        />
      ))}
    </div>
  );
}

export function Butterfly({ working }: { working: boolean }) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduce) return;
    if (working) {
      void v.play().catch(() => {});
    } else {
      v.pause();
      // Reload so the poster frame is shown again while idle.
      v.load();
    }
  }, [working, reduce]);

  // Bob in both live states; working gets a smaller, quicker hover.
  const bob = reduce ? null : working ? [0, -5, 0] : [0, -8, 0];

  return (
    <div className="relative flex justify-center">
      {!reduce && working && <PulseRings />}

      <motion.div
        // bg-bg gives mix-blend-multiply a painted backdrop inside this
        // transformed stacking context, so the asset's white ground melts away.
        className="relative z-[1] h-40 w-40 bg-bg"
        animate={bob ? { y: bob } : { y: 0 }}
        transition={
          bob
            ? { duration: working ? 2.2 : 3.2, ease, repeat: Infinity }
            : { duration: 0.3, ease }
        }
      >
        {reduce ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/butterfly-poster.png"
            alt="Your energy agent, a calm butterfly, at rest"
            // multiply blends the asset's white backdrop into the sage surface
            className="h-full w-full object-contain mix-blend-multiply"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-contain mix-blend-multiply"
            poster="/butterfly-poster.png"
            loop
            muted
            playsInline
            aria-label={working ? "Agent working" : "Agent watching"}
          >
            <source src="/butterfly.webm" type="video/webm" />
            <source src="/butterfly.mp4" type="video/mp4" />
          </video>
        )}
      </motion.div>
    </div>
  );
}
