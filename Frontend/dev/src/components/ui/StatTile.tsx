import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

/**
 * A compact metric tile: big value, small label, optional sub/hint.
 * `tone` tints the value using the semantic vocabulary only.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "ink",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "green" | "amber" | "red";
  className?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-green"
      : tone === "amber"
        ? "text-amber"
        : tone === "red"
          ? "text-red"
          : "text-ink";
  return (
    <Card className={cn("p-3.5", className)}>
      <div className="text-xs font-medium text-sub">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tracking-tight tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-sub">{hint}</div>}
    </Card>
  );
}
