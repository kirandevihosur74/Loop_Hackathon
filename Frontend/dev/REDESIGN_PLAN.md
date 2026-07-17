# Powerfly Warm Re-skin — Swarm Plan

Five agents restyle five screens in parallel. The foundation (warm palette, day/night theme, 5px radius, ui primitives) is **already rebuilt and frozen**. This is a re-skin plus exactly 4 behavioral deltas (hero theme wiring, radius, Agent working-state choreography, My Home button row). Logic and data wiring stay.

---

## 1. Ownership map (STRICT — no overlaps)

| Agent | Owns (may edit ONLY these) |
|---|---|
| **Home** | `src/app/page.tsx` + `src/components/home/*` (HomeHero.tsx, LiveUsageChart.tsx, NudgeCard.tsx) |
| **Schedule** | `src/app/schedule/page.tsx` + `src/components/schedule/*` (WeekStrip.tsx, DayCell.tsx, MonthGrid.tsx, AdviceChecklist.tsx, dateUtils.ts) |
| **Stats** | `src/app/stats/page.tsx` + `src/components/stats/*` (TimingRing.tsx, HourlyBars.tsx, ApplianceBars.tsx, SplitRings.tsx, SavingsCard.tsx) |
| **Agent** | `src/app/agent/page.tsx` + `src/components/agent/*` (Butterfly.tsx, CheckStream.tsx, SelfCorrectionCard.tsx, TrustLedger.tsx) |
| **MyHome** | `src/app/my-home/page.tsx` + `src/components/myhome/*` (ScanButton.tsx, ImportBillCard.tsx, ApplianceList.tsx, AddApplianceForm.tsx, icons.tsx) |

**READ-ONLY — already done, do NOT edit:**
- `src/app/globals.css`, `src/app/layout.tsx` (NO_FLASH script is already wired there)
- `src/lib/*` — `tokens.ts`, `useTheme.ts`, `motion.ts`, `cn.ts`, `types.ts`, `data/*`
- `src/components/ui/*` (Card, Pill, badges, buttons, StatTile, SectionHeader, ThemeToggle) and `src/components/layout/*` (PhoneFrame, BottomNav, Screen)
- `package.json`, configs, `public/*` assets

**Rules:**
- No cross-screen imports (e.g. Schedule must never import from `@/components/home`). Shared things come only from `@/components/ui`, `@/components/layout`, `@/lib/*`.
- The data layer (`@/lib/data`) and types (`@/lib/types`) **must not change** — every existing fetch call, optimistic update, and rollback stays exactly as-is. You are restyling around the logic, not rewriting it.
- If a ui/layout primitive seems to need a change: it doesn't. Compose around it in your own files.
- Repo note: per `AGENTS.md`, this Next.js version has breaking changes — check `node_modules/next/dist/docs/` before using any Next API you're unsure about (screens are all client components, so this rarely comes up).

---

## 2. New color vocabulary (STRICT)

All from the `@theme` block in `src/app/globals.css`. Every token is a CSS var that auto-switches day/night — use the utility, get both themes free.

**Surfaces:** `bg-bg` (app shell #FBF7F0 day / #14171C night) · `bg-card` (white / #1E232B) · `bg-card-elevated` · `bg-nav`
**Text / lines:** `text-ink` (#2A2620) · `text-sub` (#8C8375) · `border-line` / `ring-line` (#EFE7DA)
**Brand gold:** `bg-gold` / `text-gold` (#EF9A31) · `text-gold-deep` (#D07E1B; collapses to bright gold at night for contrast) · `bg-gold-tint` (#FCEBCF; translucent at night). Text on solid gold is always `text-white`.
**Price ramp** (maps to `GridState`): `cheap` → `bg-cheap`/`bg-cheap-tint` (yellow #F6C544), `medium` → `bg-medium`/`bg-medium-tint` (orange #EC8B2E), `expensive` → `bg-peak`/`bg-peak-tint` (rust #C24B2E). `text-cheap`/`text-medium`/`text-peak` also exist.

**Semantics:** gold = brand / primary / savings / active / "good" / handled. Price ramp = time-of-use heat only (cheap/medium/peak). Never use ramp colors for "success" and never use gold for a price state.

**Deprecated:** `bg-green`, `text-green`, `green-light`, `green-deep`, `amber`, `amber-light`, `red`, `red-light` still compile (aliased to warm in `@theme`) but are **forbidden in edited code**. Every screen currently uses them — migrating them is the bulk of your job. Mapping: green→gold, green-light→gold-tint, green-deep→gold-deep, amber→medium, amber-light→medium-tint, red→peak, red-light→peak-tint. Same for the `color.green/amber/red` aliases in tokens.ts.

**Hand-rolled SVG / inline styles:** import from `@/lib/tokens`:
- `cssVar` — theme-aware `var()` strings: `cssVar.gold`, `cssVar.goldDeep`, `cssVar.goldTint`, `cssVar.cheap`, `cssVar.medium`, `cssVar.peak`, `cssVar.ink`, `cssVar.sub`, `cssVar.line`, `cssVar.card`. **Prefer these for every `fill`/`stroke`/inline background** — they follow night mode.
- `color` — raw DAY hex literals (`color.gold`, `color.cheap`, …). Only for places a `var()` string genuinely can't go (framer-motion color interpolation, canvas). A raw literal will NOT adapt at night.
- `gridColor: Record<GridState, {base, light, deep}>` — price-ramp set per grid state (day literals; for theme-aware fills map the state to `cssVar.cheap/medium/peak` instead).
- `gridLabel` ("Cheap"/"Medium"/"Peak") and `confidenceLabel` for copy.

No hardcoded hex anywhere in edited files, except the sanctioned hero-sky/celestial exception on Home (§6) and the butterfly's own plumage on Agent (§6).

---

## 3. Radius rule (delta 1)

The theme sets `--radius-sm/md/lg` **all = 5px** and `--radius-pill = 999px`. So `rounded-sm`, `rounded-md`, `rounded-lg` are identical — use `rounded-md` for anything rectangular you write: cards, buttons, inputs, stat tiles, chips, segmented toggles, day cells, checklist rows, bar-chart corner radii (`radius.md` from tokens = `5` for SVG `rx`).

**Stays circular** (`rounded-full` or `rounded-pill`): progress/timing rings, mini rings, avatars and round appliance-icon dots, status/price dots, checkbox circles, spinner rings, the butterfly and its pulse rings, the round delete button, the ThemeToggle. Audit your files for leftover `rounded-pill` on *rectangles* (e.g. skeleton lines, the NudgeCard flow-strip chips, TrustLedger's "Re-open" button, ApplianceBars/SavingsCard track bars) — flip those to `rounded-md`/`rounded-sm`; tiny 2–3px-tall progress tracks may keep pill ends if they read better, but chips and buttons must be 5px.

The ui primitives (Card `rounded-lg`, Pill/buttons `rounded-md`) already resolve to 5px — no action needed there.

---

## 4. Theme rule (delta 2)

Day/night is done at the foundation: `useTheme()` in `src/lib/useTheme.ts` reads/writes the `night` class on `<html>`; the NO_FLASH script in `layout.tsx` sets it before paint from localStorage/system preference. **Do not reimplement any of this.** Use the token utilities and both themes come free.

Only two things need explicit night handling:

**(a) Home hero (Home agent only).** The sky gradient must use the CSS vars `--hero-1` / `--hero-2` / `--hero-3` (warm peach by day → deep blue by night, defined in globals.css): `background: linear-gradient(180deg, var(--hero-1), var(--hero-2) 55%, var(--hero-3))`. Swap a SUN (day) for a MOON (night) driven by `useTheme().theme`, cross-faded with framer-motion (`AnimatePresence` + opacity, ~500–700ms, `ease` from `@/lib/motion`). Critical: **HomeHero.tsx currently keeps its own local `useState<Mode>` and its own toggle button with hardcoded blue-sky hexes — delete all of that** and drive everything from `useTheme()`. The header's sun/moon button IS the app-wide toggle: `import { ThemeToggle } from "@/components/ui"` and drop it in the header row. It's circular and self-managing. Do NOT build another toggle.

**(b) Raw hex in SVG.** Several components pass `color.*` day literals into `fill`/`stroke`/`style` (TimingRing, HourlyBars, ApplianceBars, SplitRings, SavingsCard, ScanButton's sweep, LiveUsageChart gradients, SVG `<text>` fills). These stay wrong-colored at night unless you switch them to `cssVar.*`. Do so wherever the value lands in DOM attributes/styles (that's nearly everywhere).

Note: globals.css already cross-fades all colors 200ms on toggle and nukes animation under `prefers-reduced-motion` — don't add your own theme transitions.

---

## 5. Shared conventions

- `"use client"` on interactive pages/components (all five pages already have it — keep).
- **Keep each page's existing data pattern**: fetch via `@/lib/data` in `useEffect` with the `alive` guard, calm pulsing skeleton while null (no spinners for loading), optimistic toggles with rollback (AdviceChecklist, ApplianceList delete). Restyle skeletons (5px radii, `bg-card`/`bg-bg`) but keep their structure/no-layout-jump behavior.
- **Motion:** framer-motion only, importing shared voice from `@/lib/motion` — `ease`, `springSoft`, `enter`, `staggerContainer`, `staggerRow`, `noMotion`. Always call `useReducedMotion()` and degrade: swap variants for `noMotion`, skip loops/spinners/pulses, show end states instantly.
- **Look (from the reference):** iOS-modern; `shadow-soft` on cards (never harsh borders — hairlines are `ring-1 ring-line`); generous spacing (p-4 cards, gap-2 lists, mt-5/6 between sections); system font stack (already global); tabular-nums on figures; uppercase tracking-wide eyebrows in `text-sub` or `text-gold-deep`; stakes-first copy (lead with money/consequence: "Saves $1.40 · +8 credits").
- **Confidence is always a Low/Med/High band** (`ConfidenceBadge`), never a percentage.
- **Accessibility:** every control labelled (`aria-label`/`aria-pressed`/roles already present — preserve them), min 44px tap targets (`min-h-[44px]`+), AA contrast in BOTH themes (test `text-gold-deep` on tints in night mode — the tokens are tuned for it; don't invent new combos), visible focus is global (gold outline in globals.css — don't suppress it).
- **Stats + My Home read the curated hardware-analytics dataset** (`src/lib/data/hardware.ts` feeding `getStats`/`getAppliances`). Do not touch it; do not rename fields; restyle around it.

---

## 6. Per-screen briefs

### HOME — `src/app/page.tsx`, `components/home/*`
Target: warm price-forecast "weather" hero + overlapping white sheet + running-now row + gold nudge.

- **HomeHero.tsx (biggest rewrite).** Becomes a price-forecast hero, not a photo sky. Keep the address header row, replace its local toggle with `<ThemeToggle />` (§4a). Hero panel (rounded-b-lg, full-bleed) on the `--hero-1/2/3` gradient contains:
  - Eyebrow `TODAY'S ELECTRICITY` (uppercase, `text-gold-deep`), big **42px ¢/kWh now** (`text-ink`, tabular) fed by the existing `grid.priceCents`, with the existing `GridStateBadge` (or an orange "Medium" pill) beside it.
  - Two small chips: `▲ Peak 5–8pm · 34¢` and `▼ Cheapest 11am · 9¢` in `text-gold-deep` on translucent white/card, `rounded-md`.
  - A smooth SVG **price curve** for the day: stroke = `<linearGradient>` yellow→gold→rust (`cssVar.cheap` → `cssVar.gold` → `cssVar.peak`), soft area fill fading to transparent; dashed vertical "now" line + white now-dot (`fill: cssVar.card`, gold ring); a peak dot labeled "34¢" and a low dot "9¢"; small sun glyph near the curve by day that cross-fades to a moon at night via `useTheme()` (§4a); tiny axis labels `12AM … 12AM` in `text-sub`/`cssVar.sub`. Curve data may be derived/mocked locally in the component — do NOT add data-layer functions.
  - Delete `HAS_HERO_IMAGES`, the `<Image>` slot, `Stars`, and the hardcoded `#7FB6E6…` gradients. The celestial sun/moon radial-gradient discs may keep their own warm/pale hexes (sanctioned exception, kept inside HomeHero).
- **page.tsx:** keep the fetch trio (`getLiveUsage/getGridState/getCurrentNudge`) and the overlapping-sheet structure (`-mt-5 rounded-t-lg bg-card`). Restyle skeleton radii.
- **LiveUsageChart.tsx:** keep the drift interval + eased path morph. Replace `rateTone`'s `text-green/amber/red` with `text-gold/text-medium/text-peak` (or map via grid state to ramp). Chart stroke/gradient: switch `gridColor[...].base` literals to `cssVar.cheap/medium/peak` picked by `grid.state`. "Running now" header stays (eyebrow + big W number).
- **NudgeCard.tsx:** the "Handled for you" card. Auto-acted tone → `bg-gold-tint ring-gold/20`; savings line → `text-gold-deep`; credits pop chip → `bg-gold`, `rounded-md`; flow-strip chips → `rounded-md`. `PrimaryButton`/`GhostButton`/`ConfidenceBadge` are already warm — just use them. Eyebrow "Handled for you", ●●○ Med confidence, bold stakes title, muted why, "Saves $1.40 · +8 credits" in gold-deep.

### SCHEDULE — `src/app/schedule/page.tsx`, `components/schedule/*`
Target: warm week strip, Week/Month segmented toggle, "Here's your plan for today" checklist with gold savings.

- **page.tsx:** structure stays (Week/Month `Pill` toggle in `SectionHeader.trailing`, lazy month load, selected-day state). Fix the subtitle copy — it says "green cheap · amber medium · red peak"; make it "Dots show grid price: yellow cheap · orange medium · rust peak" (matching the ramp).
- **DayCell.tsx:** `DOT` map → `bg-cheap` / `bg-medium` / `bg-peak`. Selected state `bg-green-light ring-2 ring-green` → `bg-gold-tint ring-2 ring-gold`; selected/today text `text-green-deep`/`text-green` → `text-gold-deep`/`text-gold`; hover ring → `hover:ring-gold`. Cells stay `rounded-md` (now 5px); price dot and today-underline stay pill/round. Keep radio semantics, aria-labels, 44px+ targets, `$` cost under each day.
- **WeekStrip.tsx / MonthGrid.tsx:** structural pass-throughs — verify spacing/radius only.
- **AdviceChecklist.tsx:** the emotional core. All `green*` → gold family: header savings `text-gold` / captured `text-gold-deep`, done rows `bg-gold-tint`, checkbox circle `border-gold bg-gold text-white` when done (circle stays `rounded-pill`), row container `rounded-md`, per-row savings amounts `text-gold`/`text-gold-deep`, "Plan complete" line `text-gold-deep`. Keep optimistic toggle + rollback, stagger variants, spring check pop, strike-through done text.

### STATS — `src/app/stats/page.tsx`, `components/stats/*`
Target: gold timing ring, ramp-colored hourly bars with legend, gold appliance tracks, two mini rings, gold savings card. **The `getStats(range)` wiring (hardware-analytics dataset) is sacred — colors and radii only, plus cssVar migration.**

- **page.tsx:** keep range Pills, keep the dim-while-in-flight `opacity-60` pattern and skeletons. Fix the HourlyBars subtitle ("…in green hours…" → "Taller bars in yellow hours mean cheaper, cleaner power.").
- **TimingRing.tsx:** the ring is **always gold**: arc `cssVar.gold`, track `cssVar.goldTint` (day resolves to the reference's #F1E7D6-ish tint). Drop the `GOOD_THRESHOLD` green/amber branch — gold is the brand ring regardless of score (keep the sweep animation + reduced-motion skip). Center text fills → `cssVar.ink` / `cssVar.sub` (currently day literals — night bug).
- **HourlyBars.tsx:** bar fills → `cssVar.cheap/medium/peak` mapped from `h.gridState` (replace `gridColor[...].base` literals); axis text fill → `cssVar.sub`; bar `rx` stays small (2–3). Legend chips already iterate cheap/medium/expensive with `gridLabel` — switch their swatch backgrounds to `cssVar.*` too, labels read Cheap / Medium / Peak.
- **ApplianceBars.tsx:** track `cssVar.goldTint`, fill `cssVar.gold` (replaces `color.greenLight/green`). Tracks may keep pill ends; keep width-grow animation.
- **SplitRings.tsx:** Home ring gold (`cssVar.gold` / track `cssVar.goldTint`), Car ring medium-orange (`cssVar.medium` / a `medium-tint` var — add `var(--medium-l)` inline since cssVar has no tint entry for it) so the two are distinguishable. Center % text → `cssVar.ink`.
- **SavingsCard.tsx:** "Saved this month" uses the read-only `StatTile` whose tone prop is still `"green"` — passing `tone="green"` is acceptable here (it aliases to gold); do not edit StatTile. BenchBar fills: you-bar `cssVar.gold` when cheaper / `cssVar.peak` when over; neighbors `cssVar.sub`; track `cssVar.line`. Card copy stays stakes-first.

### AGENT (delta 3 — the showpiece) — `src/app/agent/page.tsx`, `components/agent/*`
Target: a visibly *alive* working state. Extend the existing files — the timer choreography in page.tsx (`ROW_GAP`/`ROW_SETTLE`/`CORRECTION_*`, `phases` map, `clearTimers`) is your backbone; tune `ROW_GAP` to ~600ms per the spec.

- **Butterfly.tsx:** currently a video/poster with an idle bob. Rework as (or overlay with) the reference **SVG butterfly** — peach wings `#F0A98C`/`#F3B99F`, yellow body `#F6C544`, gold-tint circles behind (these plumage hexes are a sanctioned exception; or use `color.cheap`/`goldTint` where they match). Two states via the existing `working` prop:
  - **Working:** wing-flap loop ~180ms (animate wing group `scaleX`/`rotateY` around the body axis, `repeat: Infinity`) + **pulsing concentric rings** behind it — 2–3 absolutely-positioned `rounded-full` circles in gold, each animating `scale: 1→~1.9`, `opacity: 0.35→0`, staggered delays, ~1.6s loop — a soft radar. Rings unmount/stop when idle.
  - **Idle:** slow bob (keep the existing 3.2s y-loop), wings still or very slow, no rings.
  - Reduced motion: static butterfly, no flap, no rings, no bob.
- **page.tsx:** status line stays ("Watching · next check in mm:ss" idle countdown / "Checking your home…" working). "Run a check" stays a `PrimaryButton`; while `busy` give it a live label ("Running a check…") — the working state must also trigger on the cadence path if one exists (the countdown reaching 0 may simply loop; wiring it to auto-run is optional and fine if timers are cleaned up). Replace the fallback result card's `bg-green-light` with `bg-gold-tint`.
- **CheckStream.tsx:** rows appear **one at a time, staggered ~600ms**. Each row starts as a **circular spinner** — upgrade the current `border-t-green` div to a small SVG ring that spins *and* fills (stroke-dashoffset sweep in `cssVar.gold`, track `cssVar.line`) — then resolves to a gold checkmark (`bg-gold` circle, white tick) with the finding fading in beside it ("Spot price → 22¢, medium"). Add below the *active* (checking) row a short evolving **reasoning line**: 1–2 sentences in `text-sub` italic/small that fades or types in and updates per phase (content can come from `c.finding`/`c.label` or a tiny local phrase list; no data-layer changes). Keep the `sr-only` status text and `aria-label="Agent checks"`.
- **SelfCorrectionCard.tsx:** the "↺ Changed its mind" beat. Retint from `bg-amber-light`/`text-amber` to the rust family: `bg-peak-tint`, header `text-peak`. Keep the existing sequence and sharpen it: old title strikes through + fades (`shifted` timer already does this), new recommendation slides in, and the **ConfidenceBadge visibly ticks High→Med** (both nudges' real `confidence` values — animate the badge swap with a small y-fade rather than editing ConfidenceBadge itself). `rounded-md`, `role="status"` stays.
- **TrustLedger.tsx:** after a completed run, the headline **count animates up (Handled 4→5)** — animate the number with framer-motion (`animate` a motion value or keyframe the text swap) when `entries` grows or a run completes; keep the session-local veto logic and live agreement %. "Re-open" button: `text-amber` → `text-gold-deep` (or keep rust if you prefer the veto read — pick one and note it), and `rounded-pill` → `rounded-md` (it's a rectangle). Rows stay Cards.
- **Reduced motion (whole screen):** the existing `reduce` early-path in `runCheck` (reveal all rows instantly) is the model — extend it: no flap, no rings, no spinners, no count-up, no typing; rows and cards simply fade in / appear. Never gate *information* behind motion.

### MYHOME (delta 4) — `src/app/my-home/page.tsx`, `components/myhome/*`
Target: Scan + Import side by side above the list; warm restyle; dataset wiring intact.

- **The button row (the delta):** in `page.tsx`, compose one flex row ABOVE "Your appliances": `Scan an appliance` as the filled-gold `PrimaryButton` (via existing `ScanButton`) and `Import electricity bill` as the tinted `GhostButton`, **equal width** (`flex-1` each), small gap (`gap-2`/`gap-3`), 5px radius (the buttons already are). Stack only on very small screens — e.g. `flex flex-wrap` with `min-w-[150px]` per button, or a `min-[340px]:flex-row flex-col` switch. This requires refactoring **ImportBillCard.tsx**: split its trigger button out so the button can live in the row while the hidden file input + "Reading your bill…" / "Learned from your bill" summary cards render *below the row* (full width). Cleanest shape: `ImportBillCard` exposes the button as its top-level element and renders its status cards into a sibling slot, or page.tsx hoists the row and passes layout className — your call, but scan + import *behavior* (file input reset, `importBill`, `scanAppliance` → `prepend`) must be unchanged. Shorten button labels if needed to fit half-width ("Scan appliance" / "Import bill" is acceptable); keep icons.
- **ScanButton.tsx:** keep the simulated sweep; retint framing brackets (`border-green` → `border-gold`) and the sweep line gradient (`color.green` → `cssVar.gold`). The sweep panel is full-width below the row.
- **ImportBillCard.tsx:** success card `bg-green-light`/`text-green-deep` → `bg-gold-tint`/`text-gold-deep`. Its old bottom-of-page `SectionHeader` can shrink to a caption under the row or move; the dashed-CTA look from the old mock is superseded by the GhostButton.
- **ApplianceList.tsx:** rows stay Cards (5px) — square-ish `rounded-md` icon tile, name, type, `kW` figure, and the **round** delete button (`rounded-full`, keep 44px); delete hover `hover:text-red` → `hover:text-peak`. Keep optimistic delete + rollback and the layout/exit animations.
- **page.tsx filter chips:** `Pill` already renders gold-active — no change beyond spacing. Keep the type filter logic and skeleton (restyle radii).
- **AddApplianceForm.tsx:** field focus rings `focus-visible:ring-green` → `ring-gold`; inputs `rounded-md`; buttons already warm. Keep validation + submit flow.
- **icons.tsx:** stroke-based, `currentColor` — likely zero changes; verify no raw green.

---

## 7. Integration checklist (every agent, before finishing)

1. `git status` — **only my page + my component folder** touched. Nothing in `src/lib`, `src/components/ui`, `src/components/layout`, `globals.css`, `layout.tsx`.
2. `grep -rnE "(text|bg|border|ring|from|to|via)-(green|amber|red)\b|color\.(green|amber|red)" <my files>` → **zero hits** (aliases are deprecated). No hardcoded hex outside the sanctioned exceptions (hero celestial discs, butterfly plumage).
3. SVG/inline colors use `cssVar.*` (theme-aware), not `color.*` day literals, unless technically impossible.
4. 5px (`rounded-md`) on every rectangle I touched; genuinely circular things (`rounded-full`/`rounded-pill`) stayed circular; no pill-radius chips/buttons remain.
5. Toggled day AND night (ThemeToggle on Home, or `document.documentElement.classList.toggle('night')` in devtools) — every surface, chart, and text passes AA and nothing stays day-colored.
6. `prefers-reduced-motion: reduce` checked — no spinners/pulses/loops/typing; content appears via simple fades or instantly; nothing informational is motion-gated.
7. All tap targets ≥ 44px; aria roles/labels preserved from the existing code.
8. Data logic untouched: same `@/lib/data` calls, same optimistic-update/rollback paths, Stats + My Home still render the hardware-analytics dataset values.
9. `pnpm exec tsc --noEmit` passes (clean for my files).

---

*Ambiguity rule: where this plan, the reference mock, and existing code disagree — the 4 deltas win, then this plan, then the reference, then existing styling. Existing **logic** always wins over all styling concerns.*
