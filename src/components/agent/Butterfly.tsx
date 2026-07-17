"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";

/**
 * The mascot — a calm butterfly that plays while the agent is working and rests
 * on its poster frame when idle. Respects prefers-reduced-motion: when set, we
 * never autoplay and simply show the poster image (and skip the idle bob).
 */
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

  const bob = !reduce && !working;

  return (
    <div className="flex justify-center">
      <motion.div
        // bg-bg gives mix-blend-multiply a painted backdrop inside this
        // transformed stacking context, so the asset's white ground melts away.
        className="relative h-40 w-40 bg-bg"
        animate={bob ? { y: [0, -8, 0] } : { y: 0 }}
        transition={
          bob
            ? { duration: 3.2, ease, repeat: Infinity }
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
