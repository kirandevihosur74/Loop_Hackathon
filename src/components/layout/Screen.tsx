import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Standard horizontal padding + vertical rhythm for a screen's scroll content.
 * Screens that need a full-bleed hero (e.g. Home) can opt out at the top and
 * wrap only their lower content in <Screen>.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pt-4", className)}>{children}</div>;
}
