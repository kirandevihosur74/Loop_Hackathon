import type { ApplianceType } from "@/lib/types";

/**
 * One small inline icon per ApplianceType, drawn with `currentColor` so the
 * parent row controls the tint. 24×24 viewBox, stroke-based, calm weight.
 */

type IconProps = { className?: string };

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function EvIcon(props: IconProps) {
  // Car body + charging bolt
  return base(
    <>
      <path d="M4 15v-3.2l1.6-3.4A2 2 0 0 1 7.4 7h6.2a2 2 0 0 1 1.8 1.1L17 11.8V15" />
      <path d="M3.5 15h14" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="14" cy="17" r="1.5" />
      <path d="M20 7.5l-2 3h2l-2 3" />
    </>,
    props,
  );
}

function HvacIcon(props: IconProps) {
  // Fan blades
  return base(
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 10.4C12 7 10.5 5.5 8 6c1.8 1 1.9 3 4 4.4Z" />
      <path d="M13.6 12c3.4 0 4.9-1.5 4.4-4-1 1.8-3 1.9-4.4 4Z" />
      <path d="M12 13.6c0 3.4 1.5 4.9 4 4.4-1.8-1-1.9-3-4-4.4Z" />
      <path d="M10.4 12C7 12 5.5 13.5 6 16c1-1.8 3-1.9 4.4-4Z" />
    </>,
    props,
  );
}

function KitchenIcon(props: IconProps) {
  // Fork + knife
  return base(
    <>
      <path d="M8 3v7M6 3v3.5a2 2 0 0 0 4 0V3M8 10v11" />
      <path d="M16 3c-1.6 0-2.4 2-2.4 4.5S14.4 12 16 12v9" />
    </>,
    props,
  );
}

function LaundryIcon(props: IconProps) {
  // Washing machine
  return base(
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="13" r="4" />
      <circle cx="12" cy="13" r="1.4" />
      <path d="M8 6.5h.01M11 6.5h.01" />
    </>,
    props,
  );
}

function ElectronicsIcon(props: IconProps) {
  // Monitor
  return base(
    <>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>,
    props,
  );
}

function OtherIcon(props: IconProps) {
  // Plug
  return base(
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0V8Z" />
      <path d="M12 16v5" />
    </>,
    props,
  );
}

const ICONS: Record<ApplianceType, (p: IconProps) => React.ReactElement> = {
  ev: EvIcon,
  hvac: HvacIcon,
  kitchen: KitchenIcon,
  laundry: LaundryIcon,
  electronics: ElectronicsIcon,
  other: OtherIcon,
};

export function TypeIcon({ type, className }: { type: ApplianceType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} />;
}
