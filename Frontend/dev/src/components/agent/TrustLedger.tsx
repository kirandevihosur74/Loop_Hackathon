"use client";

import { useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import type { LedgerEntry } from "@/lib/types";
import { Card, SectionHeader } from "@/components/ui";
import { ease, noMotion, staggerContainer, staggerRow } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Coarse relative-time label (e.g. "2h ago"). */
function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/** A number that counts up to its target when it grows (e.g. Handled 4 → 5). */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.7, ease });
    return controls.stop;
  }, [value, reduce, mv]);

  if (reduce) return <>{value}</>;
  return <motion.span>{rounded}</motion.span>;
}

/**
 * The trust ledger — the actions the agent took on its own. The headline is
 * computed from the counts: entries the user does NOT re-open this session
 * count as "kept". Re-opening (a veto) moves the entry out of "kept" and
 * updates the agreement stat live. `bump` (completed runs this session) lifts
 * the handled/kept counts so the headline count animates up after a run.
 * Vetoes and bumps are session-local state.
 */
export function TrustLedger({
  entries,
  bump = 0,
}: {
  entries: LedgerEntry[];
  bump?: number;
}) {
  const reduce = useReducedMotion();
  const [vetoed, setVetoed] = useState<Set<string>>(() => new Set());

  const handled = entries.length + bump;
  const kept = handled - vetoed.size;
  const pct = handled === 0 ? 0 : Math.round((kept / handled) * 100);

  return (
    <section aria-label="Trust ledger">
      <SectionHeader title="Trust ledger" subtitle="What the agent did on its own." />

      <Card className="mb-3">
        <p className="text-sm tabular-nums">
          <span className="font-bold text-ink">
            Handled <CountUp value={handled} reduce={!!reduce} />
          </span>
          <span className="text-sub">
            {" "}
            · you kept <CountUp value={kept} reduce={!!reduce} /> ·{" "}
          </span>
          <span className="font-semibold text-gold-deep">{pct}% agreement</span>
        </p>
      </Card>

      <motion.ul
        variants={reduce ? noMotion : staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {entries.map((e) => {
          const isVetoed = vetoed.has(e.id);
          return (
            <motion.li key={e.id} variants={reduce ? noMotion : staggerRow}>
              <Card
                className={cn(
                  "flex items-start justify-between gap-3 transition-opacity",
                  isVetoed && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm text-ink",
                      isVetoed && "text-sub line-through",
                    )}
                  >
                    {e.text}
                  </p>
                  <p className="mt-1 text-xs text-sub">
                    {relTime(e.when)}
                    {isVetoed && " · re-opened"}
                  </p>
                </div>

                {e.canReopen && !isVetoed && (
                  <button
                    type="button"
                    onClick={() =>
                      setVetoed((s) => {
                        const next = new Set(s);
                        next.add(e.id);
                        return next;
                      })
                    }
                    aria-label={`Re-open: ${e.text}`}
                    className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-semibold text-gold-deep ring-1 ring-line transition-transform active:scale-[0.98]"
                  >
                    Re-open
                  </button>
                )}
              </Card>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
