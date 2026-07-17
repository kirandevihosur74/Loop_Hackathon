import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The main call-to-action. Accent-filled, full-height tap target (44px+),
 * 11px radius. Subtle press (scale 0.97) + hover. One primary action per view.
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
        "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gold px-5 text-base font-semibold text-white shadow-[0_6px_16px_var(--shadow-color-strong)] transition-[transform,filter,background-color] duration-150 hover:brightness-[1.04] active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
