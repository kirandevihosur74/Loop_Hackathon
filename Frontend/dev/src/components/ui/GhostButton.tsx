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
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-gold-tint px-5 text-base font-semibold text-gold-deep ring-1 ring-line transition-[transform,filter,color] duration-150 hover:brightness-[0.98] active:scale-[0.97]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
