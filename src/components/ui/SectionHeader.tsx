import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled section divider with optional trailing control (toggle, link). */
export function SectionHeader({
  title,
  subtitle,
  trailing,
  className,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-sub">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
