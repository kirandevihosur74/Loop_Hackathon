"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, GhostButton, PrimaryButton } from "@/components/ui";
import { addAppliance } from "@/lib/data";
import { ease } from "@/lib/motion";
import type { Appliance, ApplianceType } from "@/lib/types";

/** Best-guess values a failed photo scan hands over to manual entry. */
export interface ScanPrefill {
  name?: string;
  type?: ApplianceType;
  kw?: number;
  /** Why the scan handed off (shown as a hint inside the form). */
  note?: string;
}

const TYPE_OPTIONS: { value: ApplianceType; label: string }[] = [
  { value: "ev", label: "EV" },
  { value: "hvac", label: "HVAC" },
  { value: "kitchen", label: "Kitchen" },
  { value: "laundry", label: "Laundry" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

export function AddApplianceForm({
  onAdded,
  prefill,
}: {
  onAdded: (a: Appliance) => void;
  /** When set (e.g. after an unidentified scan), the form opens prefilled. */
  prefill?: ScanPrefill | null;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ApplianceType>("kitchen");
  const [kw, setKw] = useState("");
  const [saving, setSaving] = useState(false);

  const nameId = useId();
  const typeId = useId();
  const kwId = useId();

  // Scan → manual handoff: open the form with the scanner's best guess so the
  // user only has to confirm/correct, never start from a dead end.
  useEffect(() => {
    if (!prefill) return;
    setOpen(true);
    setName(prefill.name ?? "");
    if (prefill.type) setType(prefill.type);
    if (prefill.kw !== undefined && Number.isFinite(prefill.kw) && prefill.kw > 0) {
      setKw(String(prefill.kw));
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill]);

  const kwNum = Number(kw);
  const valid = name.trim().length > 0 && kw.trim().length > 0 && Number.isFinite(kwNum) && kwNum > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const created = await addAppliance({ name: name.trim(), type, kw: kwNum });
      onAdded(created);
      setName("");
      setKw("");
      setType("kitchen");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "min-h-[44px] w-full rounded-md bg-card px-3 text-sm text-ink ring-1 ring-line focus:outline-none focus-visible:ring-2 focus-visible:ring-gold";

  return (
    <div ref={rootRef}>
      <GhostButton
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full"
      >
        {open ? "Cancel manual entry" : "Add an appliance manually"}
      </GhostButton>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <Card className="mt-3">
              {prefill?.note && (
                <p className="mb-3 text-xs text-sub" role="note">
                  {prefill.note}
                </p>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label htmlFor={nameId} className="mb-1 block text-xs font-semibold text-sub">
                    Name
                  </label>
                  <input
                    id={nameId}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chest freezer"
                    className={fieldClass}
                    autoComplete="off"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor={typeId} className="mb-1 block text-xs font-semibold text-sub">
                      Type
                    </label>
                    <select
                      id={typeId}
                      value={type}
                      onChange={(e) => setType(e.target.value as ApplianceType)}
                      className={fieldClass}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-28">
                    <label htmlFor={kwId} className="mb-1 block text-xs font-semibold text-sub">
                      Power (kW)
                    </label>
                    <input
                      id={kwId}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={kw}
                      onChange={(e) => setKw(e.target.value)}
                      placeholder="1.8"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <PrimaryButton type="submit" disabled={!valid || saving} aria-busy={saving}>
                  {saving ? "Adding…" : "Add appliance"}
                </PrimaryButton>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
