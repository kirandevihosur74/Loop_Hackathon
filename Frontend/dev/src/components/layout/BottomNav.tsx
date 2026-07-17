"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const stroke: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
};

function HomeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function ScheduleIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
function StatsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function AgentIcon(p: SVGProps<SVGSVGElement>) {
  // A tiny geometric butterfly — the agent's face.
  return (
    <svg {...stroke} {...p}>
      <path d="M12 6v12" />
      <path d="M12 8c-1.5-3-7-3.5-7 .5S10 16 12 16" />
      <path d="M12 8c1.5-3 7-3.5 7 .5S14 16 12 16" />
    </svg>
  );
}
function MyHomeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...p}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <circle cx="12" cy="14.5" r="2" />
    </svg>
  );
}

const TABS: Tab[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/schedule", label: "Schedule", Icon: ScheduleIcon },
  { href: "/stats", label: "Stats", Icon: StatsIcon },
  { href: "/agent", label: "Agent", Icon: AgentIcon },
  { href: "/my-home", label: "My Home", Icon: MyHomeIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex items-stretch justify-around px-2 pt-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold transition-colors",
                  active ? "text-gold-deep" : "text-sub hover:text-ink",
                )}
              >
                <Icon aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
