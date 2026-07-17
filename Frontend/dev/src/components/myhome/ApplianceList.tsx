"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { enter, noMotion } from "@/lib/motion";
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
}: {
  appliances: Appliance[];
  onDelete: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const variants = reduce ? noMotion : enter;

  if (appliances.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-sub">Nothing here yet — scan or add an appliance to get started.</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {appliances.map((a) => (
          <motion.li
            key={a.id}
            layout={!reduce}
            variants={variants}
            initial="hidden"
            animate="show"
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
          >
            <Card className="flex items-center gap-3 p-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold-deep"
                aria-hidden="true"
              >
                <TypeIcon type={a.type} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                <p className="text-xs text-sub">
                  {TYPE_LABEL[a.type]}
                  {a.note ? ` · ${a.note}` : ""}
                </p>
              </div>

              <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                {formatKw(a.kw)}
              </span>

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
        ))}
      </AnimatePresence>
    </ul>
  );
}
