"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, GhostButton } from "@/components/ui";
import { importBill } from "@/lib/data";
import { ease } from "@/lib/motion";

type Phase = "idle" | "reading" | "done";

/**
 * Bill-import behavior. State lives in this hook so the trigger button can sit
 * in the shared action row (half width) while the "reading" / "learned" summary
 * cards (<ImportBillSummary/>) render full-width below the row.
 */
export function useBillImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<string>("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file still fires onChange.
    e.target.value = "";
    if (!file) return;
    setPhase("reading");
    try {
      const { summary: s } = await importBill(file);
      setSummary(s);
      setPhase("done");
    } catch {
      setPhase("idle");
    }
  }

  function open() {
    inputRef.current?.click();
  }

  return { inputRef, inputId, phase, summary, handleFile, open };
}

/** The secondary (tinted) trigger + hidden file input — lives in the action row. */
export function ImportBillButton({
  inputRef,
  inputId,
  phase,
  onOpen,
  handleFile,
  className,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputId: string;
  phase: Phase;
  onOpen: () => void;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <>
      {/* Absolutely-positioned (sr-only), so it is not a flex item in the row. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,image/*"
        onChange={handleFile}
        className="sr-only"
        aria-label="Upload an electricity bill (PDF or image)"
      />

      <GhostButton
        onClick={onOpen}
        disabled={phase === "reading"}
        aria-busy={phase === "reading"}
        aria-controls={phase === "done" ? `${inputId}-summary` : undefined}
        className={className}
      >
        <BillIcon />
        {phase === "reading"
          ? "Reading bill…"
          : phase === "done"
            ? "Import another"
            : "Import bill"}
      </GhostButton>
    </>
  );
}

/** The "reading" skeleton and "learned from your bill" summary — full width below the row. */
export function ImportBillSummary({
  inputId,
  phase,
  summary,
}: {
  inputId: string;
  phase: Phase;
  summary: string;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {phase === "reading" && (
        <motion.div
          key="reading"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease }}
        >
          <Card className="mt-3" aria-live="polite">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-sub">Reading your bill…</p>
              <div className="h-3 w-3/4 animate-pulse rounded-md bg-bg" />
              <div className="h-3 w-full animate-pulse rounded-md bg-bg" />
              <div className="h-3 w-2/3 animate-pulse rounded-md bg-bg" />
            </div>
          </Card>
        </motion.div>
      )}

      {phase === "done" && (
        <motion.div
          key="done"
          id={`${inputId}-summary`}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease }}
        >
          <Card className="mt-3 bg-gold-tint" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-gold-deep" aria-hidden="true">
                <CheckIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-gold-deep">Learned from your bill</p>
                <p className="mt-1 text-sm text-ink">{summary}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BillIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5h8.5L18 7v13.5H6Z" />
      <path d="M14 3.5V7h4" />
      <path d="M8.5 12h7M8.5 15h7M8.5 9h3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}
