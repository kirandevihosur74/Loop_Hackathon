"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ease, noMotion } from "@/lib/motion";
import type { Appliance, ApplianceType } from "@/lib/types";
import { TypeIcon } from "./icons";
import { DeviceDetailsModal } from "./DeviceDetailsModal";

/**
 * Rows fade + rise in. `custom` carries the row's index so the initial batch
 * staggers on mount, while a freshly prepended row (index 0) enters instantly
 * and satisfyingly at the top. Existing rows are keyed, so they never re-run
 * their enter when the list changes.
 */
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease, delay: Math.min(i, 8) * 0.05 },
  }),
};

const TYPE_LABEL: Record<ApplianceType, string> = {
  ev: "EV",
  hvac: "HVAC",
  kitchen: "Kitchen",
  laundry: "Laundry",
  electronics: "Electronics",
  other: "Other",
};

function formatKw(kw: number): string {
  // Keep small loads readable (0.15) but trim trailing zeros on whole values.
  return `${Number(kw.toFixed(2))} kW`;
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.7 11a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.7-11" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function ApplianceList({
  appliances,
  onDelete,
  onUpdate,
}: {
  appliances: Appliance[];
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<Appliance>) => void;
}) {
  const reduce = useReducedMotion();
  const variants = reduce ? noMotion : rowVariants;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Derive from the live list so refine-loop updates + edits show in the open modal.
  const selected = selectedId ? (appliances.find((a) => a.id === selectedId) ?? null) : null;

  if (appliances.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-sub">Nothing here yet — scan or add an appliance to get started.</p>
      </Card>
    );
  }

  return (
    <>
    <ul className="flex flex-col gap-2">
      {/* No `initial={false}`: the first batch animates in (staggered by index),
          while later prepends/deletes animate individually. */}
      <AnimatePresence>
        {appliances.map((a, i) => {
          const unsure = Boolean(a.approximate || a.researching);
          return (
          <motion.li
            key={a.id}
            layout={!reduce}
            custom={i}
            variants={variants}
            initial="hidden"
            animate="show"
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.24, ease } }
            }
          >
            <Card
              className="flex items-center gap-1 p-2"
              style={unsure ? { boxShadow: "inset 0 0 0 1.5px #fb923c" } : undefined}
            >
              <button
                type="button"
                onClick={() => setSelectedId(a.id)}
                aria-label={`View details for ${a.name}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-bg active:scale-[0.99]"
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
                    unsure ? "bg-orange-500/15 text-orange-500" : "bg-gold-tint text-gold-deep",
                  )}
                  aria-hidden="true"
                >
                  <TypeIcon type={a.type} className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{a.name}</span>
                  <span className="block truncate text-xs">
                    {a.researching ? (
                      <span className="animate-pulse font-medium text-orange-500">
                        ● Refining details…
                      </span>
                    ) : a.approximate ? (
                      <span className="font-medium text-orange-500">≈ Approximate — tap to review</span>
                    ) : (
                      <span className="text-sub">
                        {TYPE_LABEL[a.type]}
                        {a.note ? ` · ${a.note}` : ""}
                      </span>
                    )}
                  </span>
                </span>

                <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                  {formatKw(a.kw)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(a.id)}
                aria-label={`Delete ${a.name}`}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sub",
                  "transition-colors hover:text-peak active:scale-95",
                )}
              >
                <TrashIcon />
              </button>
            </Card>
          </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
    <DeviceDetailsModal
      appliance={selected}
      onClose={() => setSelectedId(null)}
      onUpdate={onUpdate}
    />
    </>
  );
}
