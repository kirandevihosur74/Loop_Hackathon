import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Secondary action — neutral, low-emphasis. Pairs with a PrimaryButton. */
export function GhostButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-pill bg-card px-5 text-base font-semibold text-sub ring-1 ring-line transition-[transform,color] active:scale-[0.98] hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
