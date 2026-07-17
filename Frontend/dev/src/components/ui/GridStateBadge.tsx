import type { GridState } from "@/lib/types";
import { gridLabel } from "@/lib/tokens";
import { cn } from "@/lib/cn";

const styles: Record<GridState, string> = {
  cheap: "bg-cheap-tint text-gold-deep",
  medium: "bg-medium-tint text-medium",
  expensive: "bg-peak-tint text-peak",
};

const dot: Record<GridState, string> = {
  cheap: "bg-cheap",
  medium: "bg-medium",
  expensive: "bg-peak",
};

/** Badge showing the grid price state. Yellow cheap · orange medium · rust peak. */
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
        styles[state],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[state])} aria-hidden />
      {gridLabel[state]}
      {priceCents !== undefined && <span className="opacity-70">· {priceCents}¢</span>}
    </span>
  );
}
