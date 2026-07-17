/*
 * Real appliance/hardware energy data, curated from the repo's
 * `datasets/hardware-analytics/` dataset (per-photo device records: nameplate
 * ratings, in-use vs standby watts, estimated annual kWh).
 *
 * We bake a typed subset into the frontend so `Frontend/dev` stays
 * self-contained (portable to a future Frontend/prod). Duplicate photos of the
 * same device (product shot + nameplate shot) are collapsed to one entry, and
 * each dataset `category` is mapped to our `ApplianceType`.
 *
 * TODO(backend): source these from the live dataset / Postgres instead of this
 * curated copy. Keep the shape (name, type, kw, annualKwh, note) stable.
 */

import type { Appliance, ApplianceType } from "@/lib/types";

export interface HardwareDevice {
  id: string;
  name: string;
  type: ApplianceType;
  /** Representative in-use / nameplate power, kW. */
  kw: number;
  /** Estimated annual electricity use, kWh (drives the Stats breakdown weights). */
  annualKwh: number;
  note?: string;
}

/** Curated from datasets/hardware-analytics/dataset.json (13 photos → 10 devices). */
export const HARDWARE_DEVICES: HardwareDevice[] = [
  {
    id: "hw-water",
    name: "Wellsys S4 Water Dispenser",
    type: "kitchen",
    kw: 0.54, // nameplate 540 W
    annualKwh: 350, // dataset: 250–450 kWh/yr, hot + cold tanks held 24/7
    note: "Hot + cold tanks held 24/7 — standby dominates, not dispensing. Eco/night mode cuts the biggest cost.",
  },
  {
    id: "hw-fridge",
    name: "Whirlpool Refrigerator",
    type: "kitchen",
    kw: 0.15, // cycles 100–150 W
    annualKwh: 500, // always-on cycling load
    note: "Cycles ~100–150 W around the clock — one of the top always-on loads here.",
  },
  {
    id: "hw-projector",
    name: "Panasonic PT-RZ970 Laser Projector",
    type: "electronics",
    kw: 0.84, // ~840 W in use
    annualKwh: 300,
    note: "~840 W in use; 0.5 W eco standby, but ~35 W if left networked.",
  },
  {
    id: "hw-panels",
    name: "Room-Scheduling Touch Panels (×2)",
    type: "electronics",
    kw: 0.03, // 5–15 W each
    annualKwh: 130, // small draw but 24/7
    note: "Always-on PoE panels — tiny draw each, but they never sleep.",
  },
  {
    id: "hw-laptop-psu",
    name: "Lenovo 230 W Laptop Adapter",
    type: "electronics",
    kw: 0.23, // 30–250 W under load
    annualKwh: 180,
    note: "30–250 W under load; ~0.1–0.5 W when idle (nameplate ADL230SLC3A).",
  },
  {
    id: "hw-microwave",
    name: "Panasonic Commercial Microwave",
    type: "kitchen",
    kw: 1.5, // 1,400–1,600 W
    annualKwh: 60, // high wattage, short bursts
    note: "High wattage but short bursts; ~1–3 W standby.",
  },
  {
    id: "hw-fancoil",
    name: "Hydronic Fan-Coil Unit",
    type: "hvac",
    kw: 0.15, // blower only, 50–150 W
    annualKwh: 120,
    note: "Only the blower draws power (50–150 W); the heat itself is boiler fuel, not electricity.",
  },
  {
    id: "hw-charger",
    name: "Anker 727 GaNPrime Charging Station",
    type: "electronics",
    kw: 0.1, // up to 100 W USB
    annualKwh: 40,
    note: "Up to 100 W USB; near-zero standby (nameplate A9126).",
  },
  {
    id: "hw-toaster",
    name: "4-Slice Toaster",
    type: "kitchen",
    kw: 1.6, // 1,400–1,800 W
    annualKwh: 12, // seconds at a time
    note: "1,400–1,800 W but only seconds at a time — a tiny annual total.",
  },
  {
    id: "hw-baseboard",
    name: "Hydronic Baseboard Convector",
    type: "hvac",
    kw: 0.0, // ~0 W electric
    annualKwh: 2,
    note: "Heat comes from the building boiler, not electricity — ~0 W on the electric ledger.",
  },
];

/** Extra devices a repeat "scan" can surface (rotates through these). */
export const HARDWARE_SCAN_EXTRAS: HardwareDevice[] = [
  {
    id: "hw-scan-heater",
    name: "Space Heater",
    type: "hvac",
    kw: 1.5,
    annualKwh: 200,
    note: "Detected via scan — 1,500 W on high; a heavy peak-hour load.",
  },
  {
    id: "hw-scan-monitor",
    name: "27\" Desk Monitor",
    type: "electronics",
    kw: 0.05,
    annualKwh: 90,
    note: "Detected via scan — ~50 W in use, ~0.5 W standby.",
  },
  {
    id: "hw-scan-dishwasher",
    name: "Dishwasher",
    type: "kitchen",
    kw: 1.8,
    annualKwh: 270,
    note: "Detected via scan — run it off-peak to save the most.",
  },
];

/** Map a curated hardware device to the app's Appliance shape. */
export function toAppliance(d: HardwareDevice): Appliance {
  return { id: d.id, name: d.name, type: d.type, kw: d.kw, note: d.note };
}
