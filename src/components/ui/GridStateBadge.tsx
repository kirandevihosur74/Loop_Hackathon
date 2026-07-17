import type { GridState } from "@/lib/types";
import { gridLabel } from "@/lib/tokens";
import { cn } from "@/lib/cn";

const styles: Record<GridState, string> = {
  cheap: "bg-green-light text-green-deep",
  medium: "bg-amber-light text-amber",
  expensive: "bg-red-light text-red",
};

const dot: Record<GridState, string> = {
  cheap: "bg-green",
  medium: "bg-amber",
  expensive: "bg-red",
};

/** Pill showing the grid price state. Green cheap · amber medium · red peak. */
export function GridStateBadge({
  state,
  priceCents,
  className,
}: {
  state: GridState;
  priceCents?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold",
        styles[state],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-pill", dot[state])} aria-hidden />
      {gridLabel[state]}
      {priceCents !== undefined && <span className="opacity-70">· {priceCents}¢</span>}
    </span>
  );
}
