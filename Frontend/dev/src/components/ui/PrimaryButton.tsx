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
        "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gold px-5 text-base font-semibold text-white shadow-[0_6px_16px_rgba(214,126,27,0.28)] transition-[transform,background-color] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
