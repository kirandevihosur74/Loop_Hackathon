import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/**
 * A small rounded toggle chip — used for filter chips and range toggles.
 * Active state uses green (selected/good); inactive is neutral gray.
 */
export function Pill({ active = false, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[36px] items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
        active
          ? "bg-green text-white shadow-soft"
          : "bg-card text-sub ring-1 ring-line hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
