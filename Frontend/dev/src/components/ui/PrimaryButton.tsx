import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The main call-to-action. Green (good / act), full-height tap target (44px+),
 * pill radius. Use exactly one primary action per view.
 */
export function PrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-pill bg-green px-5 text-base font-semibold text-white shadow-soft transition-[transform,background-color] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
