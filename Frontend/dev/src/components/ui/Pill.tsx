import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/**
 * A small rounded toggle chip — filter chips and range toggles. Active uses the
 * brand accent; inactive is neutral. Subtle press feedback (scale 0.97).
 */
export function Pill({ active = false, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-[transform,color,background-color] duration-150 active:scale-[0.97]",
        active
          ? "bg-gold text-white shadow-soft"
          : "bg-card text-sub ring-1 ring-line hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
