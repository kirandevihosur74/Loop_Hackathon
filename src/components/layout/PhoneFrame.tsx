import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The app column. Everything renders inside a centered phone-width column
 * (max-width ~430px) so it looks like an app in a desktop browser and fills
 * the screen on a phone. Provides safe-area padding and reserves room for the
 * fixed BottomNav.
 */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh justify-center bg-bg">
      <div
        className={cn(
          "relative flex min-h-dvh w-full max-w-[430px] flex-col bg-bg",
          // Desktop: hint the phone edges with a soft frame; on mobile it's edge-to-edge.
          "sm:my-0 sm:shadow-lift",
          className,
        )}
      >
        {/* Scrollable content. Bottom padding clears the fixed nav + safe area. */}
        <div className="flex-1 pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
