# SWARM_PLAN.md — 5-agent parallel build plan

**Read this whole file before writing code.** It is the shared contract for the 5 screen agents. The foundation (types, data layer, tokens, motion, ui primitives, layout, routing) is DONE and frozen. Your job is one screen, in your own files only.

> Reminder from AGENTS.md: this Next.js version has breaking changes — read `node_modules/next/dist/docs/` guides before writing route/app code.

---

## 1. Ownership map (STRICT — no overlaps)

| Agent | May create/edit ONLY these paths |
|---|---|
| **Home** | `src/app/page.tsx` + anything under `src/components/home/` |
| **Schedule** | `src/app/schedule/page.tsx` + anything under `src/components/schedule/` |
| **Stats** | `src/app/stats/page.tsx` + anything under `src/components/stats/` |
| **Agent** | `src/app/agent/page.tsx` + anything under `src/components/agent/` (Butterfly lives here) |
| **MyHome** | `src/app/my-home/page.tsx` + anything under `src/components/myhome/` |

**Everything else is READ-ONLY. No exceptions:**

- Do NOT edit anything under `src/lib/` (types, data, tokens, motion, cn).
- Do NOT edit `src/components/ui/` or `src/components/layout/`.
- Do NOT edit `src/app/globals.css`, `src/app/layout.tsx`, or any other screen's `page.tsx`/folder.
- Do NOT touch `public/` (the butterfly assets are already there; home images are TODO placeholders, do not create them).
- Need a new shared-looking primitive? Build it inside YOUR OWN `src/components/<screen>/` folder. Never add to `ui/`.
- NO screen folder may import from another screen folder (e.g. `components/stats/*` must never import from `components/home/*`).

---

## 2. Shared imports catalogue (source of truth — these are the REAL exports)

### `@/lib/types` — types only
`GridState` (`"cheap" | "medium" | "expensive"`), `Confidence` (`"low" | "med" | "high"`), `ItemStatus` (`"investigating" | "recommended" | "auto_acted" | "awaiting_approval" | "approved" | "withdrawn" | "expired"`), `Nudge`, `UsagePoint`, `DayForecast`, `AdviceItem`, `ApplianceType` (`"ev" | "hvac" | "kitchen" | "laundry" | "electronics" | "other"`), `Appliance`, `AgentCheck`, `LedgerEntry`, `HourUsage`, `ApplianceUsage`, `SplitUsage`, `StatsSummary`, `AgentRunResult`.

Key shapes you'll lean on:
- `Nudge`: `{ id, title, detail, status: ItemStatus, confidence: Confidence, savingsUsd?, credits?, windowEndsAt?, flow?: {label,value}[] }`
- `UsagePoint`: `{ t: string; watts: number; gridState: GridState }`
- `DayForecast`: `{ date, predictedKwh, predictedCostUsd, gridState }`
- `AdviceItem`: `{ id, date, text, done, savingsUsd? }`
- `Appliance`: `{ id, name, type: ApplianceType, kw, note? }`
- `AgentCheck`: `{ id, label, finding, state: "checking" | "done" }`
- `LedgerEntry`: `{ id, text, when, canReopen }`
- `StatsSummary`: `{ range, timingScorePct, totalKwh, totalCostUsd, hourly: HourUsage[], byAppliance: ApplianceUsage[], split: { home: SplitUsage; car: SplitUsage }, savedThisMonthUsd, neighborsAvgUsd, youSpendUsd }`
- `AgentRunResult`: `{ checks: AgentCheck[]; result: Nudge; selfCorrected?: Nudge }`

### `@/lib/data` — the ONLY data import path (all async)
Forbidden: importing `@/lib/data/mock`, any DB client, or fetching data any other way.

| Function | Signature |
|---|---|
| `getLiveUsage` | `(): Promise<UsagePoint[]>` — last ~2h, ~1 point/min |
| `getCurrentNudge` | `(): Promise<Nudge \| null>` |
| `getGridState` | `(): Promise<{ state: GridState; priceCents: number }>` |
| `getWeekForecast` | `(): Promise<DayForecast[]>` |
| `getMonthForecast` | `(): Promise<DayForecast[]>` |
| `getAdviceForDate` | `(date: string): Promise<AdviceItem[]>` — ISO `YYYY-MM-DD` |
| `toggleAdvice` | `(id: string): Promise<void>` |
| `getStats` | `(range: "day" \| "week" \| "month"): Promise<StatsSummary>` |
| `runAgentCheck` | `(): Promise<AgentRunResult>` |
| `getLedger` | `(): Promise<LedgerEntry[]>` |
| `getAppliances` | `(): Promise<Appliance[]>` |
| `addAppliance` | `(a: Omit<Appliance, "id">): Promise<Appliance>` |
| `scanAppliance` | `(): Promise<Appliance>` |
| `deleteAppliance` | `(id: string): Promise<void>` |
| `importBill` | `(file: File): Promise<{ summary: string }>` |

### `@/lib/tokens` — raw hex for SVG/inline contexts only
- `color` — `{ green:"#4E8C57", greenLight:"#E4F0E6", greenDeep:"#3C6E44", amber:"#C88A22", amberLight:"#F6ECD6", red:"#C2544B", redLight:"#F5E1DE", ink:"#23272B", sub:"#7C858C", line:"#E9EDEA", bg:"#EEF2EF", card:"#FFFFFF" }`
- `radius` — `{ sm: 8, md: 16, lg: 22, pill: 999 }`
- `gridColor: Record<GridState, { base; light; deep }>` — grid state → hex set (use for chart fills/strokes)
- `gridLabel: Record<GridState, string>` — `cheap→"Cheap"`, `medium→"Medium"`, `expensive→"Peak"`
- `confidenceLabel: Record<Confidence, string>` — `low→"Low"`, `med→"Med"`, `high→"High"`

### `@/lib/motion` — shared framer-motion voice
- `ease` — `[0.22, 1, 0.36, 1] as const` (iOS-ish soft ease)
- `springSoft: Transition` — `{ type: "spring", stiffness: 320, damping: 30 }`
- `enter: Variants` — card/section gentle enter (`hidden`/`show`, y:12 → 0)
- `staggerContainer: Variants` — list container (staggerChildren 0.12)
- `staggerRow: Variants` — single row reveal (`hidden`/`show`)
- `noMotion: Variants` — reduced-motion fallback (instant, no transform)

Variant names are `hidden` / `show` — use `initial="hidden" animate="show"`.

### `@/lib/cn`
- `cn(...parts: Array<string | false | null | undefined>): string` — class joiner.

### `@/components/ui` (import from the barrel: `import { Card, Pill } from "@/components/ui"`)

| Component | Props | Notes |
|---|---|---|
| `Card` | `HTMLAttributes<HTMLDivElement>` (`className`, `onClick`, …) | White surface, `rounded-lg`, `shadow-soft`, `p-4` |
| `GridStateBadge` | `{ state: GridState; priceCents?: number; className? }` | Pill w/ dot + label, optional `· 12¢` |
| `ConfidenceBadge` | `{ level: Confidence; className? }` | The ONLY way to show confidence. Bars + Low/Med/High |
| `Pill` | `ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }` | Filter chips / range toggles; sets `aria-pressed` |
| `StatTile` | `{ label: string; value: ReactNode; hint?: ReactNode; tone?: "ink"\|"green"\|"amber"\|"red"; className? }` | Compact metric tile (renders a Card) |
| `SectionHeader` | `{ title: string; subtitle?: string; trailing?: ReactNode; className? }` | Section divider w/ optional trailing control |
| `PrimaryButton` | `ButtonHTMLAttributes<HTMLButtonElement>` | Green pill CTA, full width, min-h 48px. ONE per view |
| `GhostButton` | `ButtonHTMLAttributes<HTMLButtonElement>` | Neutral secondary, pairs with PrimaryButton |

### `@/components/layout`
- `Screen` — `{ children; className? }` → `px-4 pt-4` wrapper for scroll content.
- `PhoneFrame` and `BottomNav` are **already applied globally in `src/app/layout.tsx`**. Your page renders INSIDE them. Never import or re-wrap PhoneFrame/BottomNav in a page. PhoneFrame already reserves bottom padding for the nav.

### `public/` assets (Agent screen)
`/butterfly.webm`, `/butterfly.mp4`, `/butterfly-poster.png`. (`/home-day.png` and `/home-night.png` do NOT exist yet — Home leaves TODO `<Image>` placeholder slots, does not create them.)

---

## 3. Tailwind token utilities (the ONLY color vocabulary)

Tailwind v4 `@theme` in `globals.css` generates these utilities. Use them and nothing else:

| Purpose | Utilities |
|---|---|
| Surfaces | `bg-bg` (app background), `bg-card` (white surface) |
| Text | `text-ink` (primary), `text-sub` (secondary) |
| Hairlines | `border-line`, `ring-line` (e.g. `ring-1 ring-line`) |
| Green (good/cheap/resolved) | `text-green`, `bg-green`, `bg-green-light`, `text-green-deep`, `bg-green-deep` |
| Amber (medium/in-progress/needs-you) | `text-amber`, `bg-amber`, `bg-amber-light` |
| Red (peak/expensive/attention) | `text-red`, `bg-red`, `bg-red-light` |
| Radii | `rounded-sm` (8), `rounded-md` (16), `rounded-lg` (22), `rounded-pill` (999) |
| Shadows | `shadow-soft`, `shadow-lift` |

**STRICT rules:**
- No color outside this vocabulary — no arbitrary `bg-[#...]`, no Tailwind default palette (`bg-blue-500`, `text-gray-400`, etc.). Exceptions: `text-white`/`bg-white` on colored fills (existing primitives do this), and the Home hero sky gradients (see brief).
- Confidence is ALWAYS a Low/Med/High band via `<ConfidenceBadge level={...} />` — never a percentage, never a custom rendering.
- Hand-rolled SVG charts take colors from `gridColor` / `color` in `@/lib/tokens` (raw hex). Never hardcode a hex in a component.

---

## 4. Conventions every agent MUST follow

**Client components.** Every screen is interactive → `"use client"` at the top of the page and of any interactive component.

**Data fetching.** The mock uses `Date`/`Math.random`, so server-rendering data causes hydration mismatch. Fetch on mount, hold in state, render a calm loading state first:

```tsx
"use client";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/data";
import type { StatsSummary } from "@/lib/types";

const [stats, setStats] = useState<StatsSummary | null>(null);
useEffect(() => {
  let alive = true;
  getStats("day").then((s) => alive && setStats(s));
  return () => { alive = false; };
}, []);
if (!stats) return <Screen><div className="h-40 animate-pulse rounded-lg bg-card" /></Screen>;
```

Loading state = quiet skeleton (pulsing `bg-card` blocks) — no spinners, no layout jump.

**Mutations** (`toggleAdvice`, `addAppliance`, `deleteAppliance`, `scanAppliance`, `importBill`). Recommended pattern — optimistic update, then call, refetch only on failure:

```tsx
async function onToggle(id: string) {
  setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); // optimistic
  try { await toggleAdvice(id); }
  catch { setItems(await getAdviceForDate(date)); } // rollback via refetch
}
```
For create-type calls that return the new entity (`scanAppliance`, `addAppliance`): `await` the call, then append the returned object to state (no full refetch needed).

**Copy is STAKES-FIRST.** Lead with the plain-English consequence, then the detail.
Example — not "EV charging schedule optimized", but: **"Your car would've charged at peak — moved to 1 am."** / detail: "Grid hits 42¢/kWh at 6 pm; overnight is 11¢. Saves $3.10."

**Accessibility.** Every control has a label (`aria-label` on icon-only buttons); focus is visible globally (don't remove outlines); AA contrast (stick to the vocabulary — `text-sub` on `bg-card` is the floor, never `text-sub` on colored fills); tap targets min 44px (primitives already comply — match them for your own controls).

**Motion.** `import { useReducedMotion } from "framer-motion"`; when it returns true, pass `noMotion` variants / skip non-essential animation (including the live-chart append easing, ring sweeps, butterfly video). All hand-rolled SVG chart animation uses framer-motion `motion.*` (or CSS transitions) and respects reduced motion. Use the shared `enter` / `staggerContainer` / `staggerRow` / `springSoft` / `ease` — do not invent new easings.

**Layout.** Wrap page content in `<Screen>` for consistent padding. Only a full-bleed hero (Home) sits above/outside `<Screen>`, at the very top. Never re-wrap `PhoneFrame`/`BottomNav`.

**Charts.** Hand-rolled SVG only — no chart libraries (nothing new in package.json at all). Responsive via `viewBox` + `width:100%` (`className="w-full h-auto"` or explicit height), `preserveAspectRatio` as needed. Colors from `@/lib/tokens`.

---

## 5. Per-screen briefs

### HOME — `/` ("Living Home") — owns `src/app/page.tsx`, `src/components/home/*`
Data: `getLiveUsage`, `getGridState`, `getCurrentNudge`.

Suggested files: `home/HomeHero.tsx`, `home/LiveUsageChart.tsx`, `home/NudgeCard.tsx`.

- Very top: address header — "123 Maple St · San Jose" — small and calm (`text-sub`), plus a day/night toggle (sun/moon icon button, `aria-label`, local state).
- Full-bleed hero with rounded BOTTOM corners, swapping day/night with the toggle: CSS gradient sky (warm day / deep-blue night — this is the one sanctioned exception to the color vocabulary, keep it in the hero only) with a simple sun or moon shape. Leave placeholder `<Image>` slots for `/public/home-day.png` and `/public/home-night.png` with a `{/* TODO: drop in home-day.png / home-night.png */}` — do NOT create the images. Overlay a small `<GridStateBadge state priceCents />`.
- Below the hero: white sheet that OVERLAPS the hero (negative margin-top, `rounded-t-lg` over the image — camping-app style). Inside the sheet, wrap content in `<Screen>` equivalents / consistent padding.
- The sheet's centerpiece: ONE big "Running now" live area chart — `LiveUsageChart`, hand-rolled SVG of watts over ~2h from `getLiveUsage()`. Big current-watts number + price rate (from `getGridState()`) above it. Area/line colored by current `gridState` via `gridColor`. Every few seconds (e.g. `setInterval` 3–5s) APPEND a new synthetic point (drift the last watts value) with an eased path update (`motion.path`/transition or CSS) — skip the animation when reduced motion; clear the interval on unmount.
- Under the chart: ONE nudge card from `getCurrentNudge()` (null → render nothing or a calm "all quiet" line). Stakes-first `title`, `<ConfidenceBadge level={nudge.confidence} />`, `savingsUsd` + `credits`, actions: `PrimaryButton` "Do it" + `GhostButton` "Later". If `status === "auto_acted"` → "Handled — undo" state (green, with a GhostButton undo) instead of Do-it/Later.

### SCHEDULE — `/schedule` (the agent's plan) — owns `src/app/schedule/page.tsx`, `src/components/schedule/*`
Data: `getWeekForecast`, `getMonthForecast`, `getAdviceForDate`, `toggleAdvice`.

Suggested files: `schedule/WeekStrip.tsx`, `schedule/MonthGrid.tsx`, `schedule/AdviceChecklist.tsx`.

- Week/Month toggle using two `Pill`s. Week = horizontal strip of 7 day cells (`getWeekForecast`); Month = compact grid (`getMonthForecast`).
- Each day cell: weekday/date, a colored dot from its `gridState` (`bg-green`/`bg-amber`/`bg-red`), and a tiny stat (`predictedKwh` or `$predictedCostUsd`). Tapping selects the day (44px targets; `aria-pressed` or radio semantics).
- Below: selected day's checklist from `getAdviceForDate(date)` — the emotional core: header like "Here's your plan for Thursday". Checkable rows (`toggleAdvice`, optimistic pattern from §4), each with its `savingsUsd` — Duolingo-style satisfying check (stagger rows with `staggerContainer`/`staggerRow`; done = `text-green` check + struck/dimmed text).

### STATS — `/stats` (smart electricity viz) — owns `src/app/stats/page.tsx`, `src/components/stats/*`
Data: `getStats(range)`.

Suggested files: `stats/TimingRing.tsx`, `stats/HourlyBars.tsx`, `stats/ApplianceBars.tsx`, `stats/SplitRings.tsx`, `stats/SavingsCard.tsx`.

Top → bottom, all hand-rolled SVG, all colors from `gridColor`/`color`:
1. **Timing score hero ring** — "You used {timingScorePct}% of your power during cheap/clean hours". Ring stroke green→amber by score (pick green ≥ some threshold, amber below — from tokens; animate the sweep, respect reduced motion).
2. **Hourly bar chart** — one bar per `hourly[]` entry (`hour` 0–23, height = `kwh`), each bar filled by `gridColor[h.gridState].base`. This is "when you used vs. when it was cheap".
3. **"Where your watts go"** — horizontal bars per `byAppliance[]` entry with name + `$costUsd` (translate kWh → dollars in copy).
4. **Home vs Car split** — two mini rings from `split.home` / `split.car`, each showing kWh + $.
5. **Savings** — `savedThisMonthUsd` headline (`StatTile` tone green) + "vs neighbors" benchmark comparing `neighborsAvgUsd` vs `youSpendUsd` (two small bars).
6. **Range toggle** Day/Week/Month via `Pill`s → refetch `getStats(range)` (keep old data visible while loading to avoid jumps).

Always translate kWh → dollars in the copy. Confidence never appears as a % — and `timingScorePct` is a score, fine as %, but confidence itself only via `ConfidenceBadge`.

### AGENT — `/agent` (the loop made visible) — owns `src/app/agent/page.tsx`, `src/components/agent/*`
Data: `runAgentCheck`, `getLedger`. (Replace the existing route shell in `agent/page.tsx`.)

Suggested files: `agent/Butterfly.tsx`, `agent/CheckStream.tsx`, `agent/SelfCorrectionCard.tsx`, `agent/TrustLedger.tsx`.

- `<Butterfly working={boolean} />`: `<video>` with `<source src="/butterfly.webm" type="video/webm" />` + `<source src="/butterfly.mp4" type="video/mp4" />`, `poster="/butterfly-poster.png"`, `loop muted playsInline` — playing when `working`, paused showing the poster when idle. `useReducedMotion() === true` → always show the poster image (never autoplay).
- Layout: butterfly top-center + status line beneath: idle = "Watching · next check in mm:ss" (local countdown timer); working = "Checking your home…".
- "Run a check" `PrimaryButton` → set `working=true`, call `runAgentCheck()`, then STREAM `checks[]` one row at a time on the client (reveal each on a timed cadence, ~600–900ms apart, using `staggerRow`/local timers): label + spinner while `checking` → green check + `finding` inline when done.
- If the result has `selfCorrected`: reveal an amber "↺ Changed its mind" card (`bg-amber-light`) that visibly revises the prior rec — old `result` title struck-through → new `selfCorrected` title, `ConfidenceBadge` shifting from old to new level. Stream it after the checks, give it room. **This is the hero beat — don't rush it.**
- Trust ledger from `getLedger()`: headline stat computed from ledger counts — "Handled N · you kept M · P% agreement" (M = entries not re-opened this session; track vetoes locally). Each `LedgerEntry` row: `text`, relative `when`, and if `canReopen` a "Re-open" (veto) control that visually moves it out of "kept".

### MYHOME — `/my-home` — owns `src/app/my-home/page.tsx`, `src/components/myhome/*`
Data: `getAppliances`, `addAppliance`, `scanAppliance`, `deleteAppliance`, `importBill`.

Suggested files: `myhome/ScanButton.tsx`, `myhome/ApplianceList.tsx`, `myhome/AddApplianceForm.tsx`, `myhome/ImportBillCard.tsx`.

- Top: "Scan an appliance" `PrimaryButton` (stub camera) → brief simulated-scan animation (~1.5s pulse/sweep, reduced-motion aware) then `await scanAppliance()` and append the returned `Appliance` to the list with an `enter` animation.
- Filter chips (`Pill`) over `ApplianceType`: All / EV / HVAC / Kitchen / Laundry / Electronics (types are lowercase in data: `"ev" | "hvac" | "kitchen" | "laundry" | "electronics" | "other"` — filter client-side over `getAppliances()` results).
- Each row: `name`, small type icon (inline SVG, `currentColor`), `kw` spec ("7.2 kW"), delete control (`deleteAppliance`, optimistic remove, `aria-label="Delete {name}"`, 44px target).
- Add-manually option: small form (name, type select, kW) → `addAppliance({ name, type, kw })`, append result.
- "Import electricity bill" — `GhostButton` + hidden `<input type="file" accept="application/pdf,image/*">`, framed as "the agent reads your bill to learn your habits" → `await importBill(file)` → show the returned `summary` in a green-tinted Card.

---

## 6. Integration checklist (run before you finish)

- [ ] I only created/edited files in MY row of the ownership map (check `git status`).
- [ ] Every import resolves from the §2 catalogue (or React/Next/framer-motion) — no `@/lib/data/mock`, no other screen's folder, no new packages.
- [ ] `pnpm typecheck` passes (clean for my files).
- [ ] No color outside the §3 vocabulary; SVG hex only via `@/lib/tokens`.
- [ ] Confidence shown only via `<ConfidenceBadge/>` — never a percentage.
- [ ] `useReducedMotion` gates all non-essential animation (charts, streams, video, countdowns' visual flair).
- [ ] All interactive targets ≥ 44px, labelled, focus-visible intact.
- [ ] Page + interactive components have `"use client"`; data fetched in `useEffect` with a calm skeleton first; intervals/timers cleaned up on unmount.
- [ ] I did not re-wrap `PhoneFrame`/`BottomNav`; lower content sits in `<Screen>`.
