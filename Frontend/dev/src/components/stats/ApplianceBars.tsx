"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ApplianceUsage } from "@/lib/types";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";

/**
 * "Where your watts go" — one horizontal bar per appliance category, sized by kWh,
 * labelled with its name and the dollars it cost.
 */
export function ApplianceBars({ items }: { items: ApplianceUsage[] }) {
  const reduce = useReducedMotion();
  const maxKwh = Math.max(...items.map((a) => a.kwh), 0.1);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => {
        const pct = (a.kwh / maxKwh) * 100;
        return (
          <li key={a.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-ink">{a.name}</span>
              <span className="tabular-nums text-sub">
                ${a.costUsd.toFixed(2)}
                <span className="text-sub"> · {a.kwh} kWh</span>
              </span>
            </div>
            <div
              className="mt-1 h-2.5 w-full overflow-hidden rounded-sm"
              style={{ backgroundColor: cssVar.goldTint }}
              role="img"
              aria-label={`${a.name}: ${a.kwh} kilowatt hours, costing $${a.costUsd.toFixed(2)}.`}
            >
              <motion.div
                className="h-full rounded-sm"
                style={{ backgroundColor: cssVar.gold }}
                initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.7, ease }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
