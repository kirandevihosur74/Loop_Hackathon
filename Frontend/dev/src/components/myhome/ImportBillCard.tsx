"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, GhostButton, SectionHeader } from "@/components/ui";
import { importBill } from "@/lib/data";
import { ease } from "@/lib/motion";

type Phase = "idle" | "reading" | "done";

export function ImportBillCard() {
  const reduce = useReducedMotion();
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

  return (
    <div>
      <SectionHeader
        title="Import your electricity bill"
        subtitle="The agent reads your bill to learn your habits and plan around your rate plan."
      />

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
        onClick={() => inputRef.current?.click()}
        disabled={phase === "reading"}
        aria-busy={phase === "reading"}
        aria-controls={phase === "done" ? `${inputId}-summary` : undefined}
        className="w-full"
      >
        <BillIcon />
        {phase === "reading" ? "Reading your bill…" : phase === "done" ? "Import another bill" : "Import electricity bill"}
      </GhostButton>

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
                <div className="h-3 w-3/4 animate-pulse rounded-pill bg-bg" />
                <div className="h-3 w-full animate-pulse rounded-pill bg-bg" />
                <div className="h-3 w-2/3 animate-pulse rounded-pill bg-bg" />
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
            <Card className="mt-3 bg-green-light" aria-live="polite">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-green-deep" aria-hidden="true">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-green-deep">Learned from your bill</p>
                  <p className="mt-1 text-sm text-ink">{summary}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
