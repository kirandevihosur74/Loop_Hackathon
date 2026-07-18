"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { Appliance, ApplianceType } from "@/lib/types";
import { TypeIcon } from "./icons";

const TYPE_LABEL: Record<ApplianceType, string> = {
  ev: "EV",
  hvac: "HVAC",
  kitchen: "Kitchen",
  laundry: "Laundry",
  electronics: "Electronics",
  other: "Other",
};
const TYPE_OPTIONS = Object.keys(TYPE_LABEL) as ApplianceType[];

/** Click-to-edit text / number field. Enter or blur saves; Escape cancels. */
function EditableText({
  value,
  onSave,
  numeric,
  multiline,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onSave(v);
  }

  const inputCls =
    "w-full rounded-md bg-bg px-2 py-1.5 text-ink ring-1 ring-gold outline-none";

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={cn(inputCls, "resize-none text-sm", className)}
      />
    ) : (
      <input
        autoFocus
        inputMode={numeric ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(inputCls, className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "-mx-1 rounded-md px-1 text-left transition-colors hover:bg-bg",
        "decoration-dotted underline-offset-4 hover:underline",
        className,
      )}
      title="Tap to edit"
    >
      {value || <span className="text-sub">{placeholder ?? "Tap to add"}</span>}
    </button>
  );
}

/**
 * Full-detail popup for one appliance. Shows the scanned photo, the whole name,
 * kW draw, and notes — every field is tap-to-edit. When the device is a
 * best-guess (approximate) it carries an orange banner explaining the estimate.
 */
export function DeviceDetailsModal({
  appliance,
  onClose,
  onUpdate,
}: {
  appliance: Appliance | null;
  onClose: () => void;
  onUpdate?: (id: string, patch: Partial<Appliance>) => void;
}) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!appliance) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [appliance, onClose]);

  // Any manual edit counts as the user reviewing the guess — clear the flags.
  function patch(p: Partial<Appliance>) {
    if (appliance) onUpdate?.(appliance.id, { ...p, approximate: false, researching: false });
  }

  return (
    <AnimatePresence>
      {appliance && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${appliance.name} details`}
        >
          <motion.div
            className="relative max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-xl bg-card shadow-soft ring-1 ring-line"
            initial={reduce ? { y: 0 } : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            onClick={(e) => e.stopPropagation()}
          >
            {appliance.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL, not a remote asset
              <img
                src={appliance.photo}
                alt={appliance.name}
                className="h-44 w-full bg-bg object-cover"
              />
            ) : (
              <div className="flex h-28 w-full items-center justify-center bg-gold-tint text-gold-deep">
                <TypeIcon type={appliance.type} className="h-12 w-12" />
              </div>
            )}

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="p-4">
              {/* Estimate banner */}
              {appliance.researching ? (
                <div className="mb-3 flex items-center gap-2 rounded-md bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-600 dark:text-orange-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                  Assessing the image and refining the details…
                </div>
              ) : appliance.approximate ? (
                <div className="mb-3 rounded-md bg-orange-500/10 px-3 py-2 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
                  An approximation has been made to define this device. We&apos;ve assessed the
                  image to the best of our capabilities — if you think we got something wrong, edit
                  any field below.
                </div>
              ) : null}

              <span
                className={cn(
                  "inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  appliance.approximate || appliance.researching
                    ? "bg-orange-500/15 text-orange-600 dark:text-orange-300"
                    : "bg-gold-tint text-gold-deep",
                )}
              >
                {TYPE_LABEL[appliance.type]}
                {appliance.approximate ? " · approx" : ""}
              </span>

              <div className="mt-1.5">
                <EditableText
                  value={appliance.name}
                  onSave={(v) => patch({ name: v })}
                  placeholder="Name this device"
                  className="break-words text-lg font-bold leading-tight text-ink"
                />
              </div>

              <dl className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-sub">
                    Power draw
                  </dt>
                  <dd className="flex items-baseline gap-1 text-xl font-bold tabular-nums text-ink">
                    <EditableText
                      value={String(Number(appliance.kw.toFixed(2)))}
                      numeric
                      onSave={(v) => {
                        const n = parseFloat(v);
                        if (Number.isFinite(n) && n > 0) patch({ kw: n });
                      }}
                      className="w-16 text-right"
                    />
                    <span className="text-sm text-sub">kW</span>
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-sub">Type</dt>
                  <dd>
                    <select
                      value={appliance.type}
                      onChange={(e) => patch({ type: e.target.value as ApplianceType })}
                      className="rounded-md bg-bg px-2 py-1 text-sm text-ink ring-1 ring-line outline-none focus:ring-gold"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>

                <div className="border-t border-line pt-3">
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-sub">Notes</dt>
                  <dd className="text-sm text-ink">
                    <EditableText
                      value={appliance.note ?? ""}
                      onSave={(v) => patch({ note: v })}
                      multiline
                      placeholder="Add a note"
                      className="block w-full"
                    />
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
