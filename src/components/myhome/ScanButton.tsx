"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PrimaryButton } from "@/components/ui";
import { scanAppliance } from "@/lib/data";
import { color } from "@/lib/tokens";
import { ease } from "@/lib/motion";
import type { Appliance } from "@/lib/types";

/**
 * Stubbed "camera" scan. On tap it plays a brief simulated-scan sweep (~1.5s,
 * reduced-motion aware), then awaits scanAppliance() and hands the detected
 * appliance up to the parent to append to the list.
 */
export function ScanButton({ onScanned }: { onScanned: (a: Appliance) => void }) {
  const reduce = useReducedMotion();
  const [scanning, setScanning] = useState(false);

  async function handleScan() {
    if (scanning) return;
    setScanning(true);
    try {
      // Simulated camera sweep before the "detection" resolves.
      if (!reduce) await new Promise((r) => setTimeout(r, 1500));
      const detected = await scanAppliance();
      onScanned(detected);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <PrimaryButton onClick={handleScan} disabled={scanning} aria-busy={scanning}>
        <CameraIcon />
        {scanning ? "Scanning…" : "Scan an appliance"}
      </PrimaryButton>

      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-card shadow-soft ring-1 ring-line">
              <div className="relative h-full w-full">
                {/* Framing brackets */}
                <div className="pointer-events-none absolute inset-4">
                  <span className="absolute left-0 top-0 h-4 w-4 rounded-tl-sm border-l-2 border-t-2 border-green" />
                  <span className="absolute right-0 top-0 h-4 w-4 rounded-tr-sm border-r-2 border-t-2 border-green" />
                  <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-sm border-b-2 border-l-2 border-green" />
                  <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br-sm border-b-2 border-r-2 border-green" />
                </div>

                {reduce ? (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-sm font-semibold text-sub">Detecting appliance…</span>
                  </div>
                ) : (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-x-6 h-0.5 rounded-pill"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${color.green}, transparent)`,
                    }}
                    initial={{ top: "18%" }}
                    animate={{ top: ["18%", "82%", "18%"] }}
                    transition={{ duration: 1.4, ease, repeat: Infinity }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l1-1.6A1 1 0 0 1 9 5h6a1 1 0 0 1 .8.4l1 1.6h1.7A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}
