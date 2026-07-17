import type { Confidence } from "@/lib/types";
import { confidenceLabel } from "@/lib/tokens";
import { cn } from "@/lib/cn";

/** Confidence is ALWAYS a Low / Med / High band — never a fake percentage. */
const styles: Record<Confidence, string> = {
  low: "bg-red-light text-red",
  med: "bg-amber-light text-amber",
  high: "bg-green-light text-green-deep",
};

const bars: Record<Confidence, number> = { low: 1, med: 2, high: 3 };

export function ConfidenceBadge({
  level,
  className,
}: {
  level: Confidence;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold",
        styles[level],
        className,
      )}
      aria-label={`Confidence: ${confidenceLabel[level]}`}
    >
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 rounded-pill bg-current"
            style={{ height: 4 + i * 3, opacity: i < bars[level] ? 1 : 0.3 }}
          />
        ))}
      </span>
      {confidenceLabel[level]}
    </span>
  );
}
