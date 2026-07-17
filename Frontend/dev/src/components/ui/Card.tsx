import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The base surface. White, `lg` radius, soft low-opacity shadow, generous padding.
 * Everything product-like sits on a Card.
 */
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg bg-card p-4 shadow-soft", className)}
      {...props}
    >
      {children}
    </div>
  );
}
