"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import type { Appliance, ApplianceType } from "@/lib/types";
import { TypeIcon } from "./icons";

const TYPE_LABEL: Record<ApplianceType, string> = {
  ev: "EV",
  hvac: "HVAC",
  kitchen: "Kitchen",
  laundry: "Laundry",
  electronics: "Electronics",
  other: "Other",
};

/**
 * Full-detail popup for one appliance — the whole name, kW, note, and the
 * scanned photo (compressed on capture). Opens when a device row is tapped.
 */
export function DeviceDetailsModal({
  appliance,
  onClose,
}: {
  appliance: Appliance | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!appliance) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [appliance, onClose]);

  return (
    <AnimatePresence>
      {appliance && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${appliance.name} details`}
        >
          <motion.div
            className="w-full max-w-sm overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-line"
            initial={reduce ? { y: 0 } : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            onClick={(e) => e.stopPropagation()}
          >
            {appliance.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL, not a remote asset
              <img
                src={appliance.photo}
                alt={appliance.name}
                className="h-48 w-full bg-bg object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center bg-gold-tint text-gold-deep">
                <TypeIcon type={appliance.type} className="h-12 w-12" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block rounded-pill bg-gold-tint px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-deep">
                    {TYPE_LABEL[appliance.type]}
                  </span>
                  <h2 className="mt-1.5 break-words text-lg font-bold leading-tight text-ink">
                    {appliance.name}
                  </h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close details"
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sub hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <dl className="mt-4 flex flex-col gap-3">
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-sub">
                    Power draw
                  </dt>
                  <dd className="text-xl font-bold tabular-nums text-ink">
                    {Number(appliance.kw.toFixed(2))} kW
                  </dd>
                </div>
                {appliance.note ? (
                  <div className="border-t border-line pt-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-sub">Notes</dt>
                    <dd className="mt-1 text-sm text-ink">{appliance.note}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
