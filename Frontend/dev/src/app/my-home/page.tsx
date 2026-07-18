"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pill, SectionHeader } from "@/components/ui";
import { Screen } from "@/components/layout/Screen";
import { enter, noMotion } from "@/lib/motion";
import { getAppliances, deleteAppliance } from "@/lib/data";
import type { Appliance, ApplianceType } from "@/lib/types";
import {
  ScanButton,
  ScanSweep,
  UploadPhotoButton,
  useScan,
} from "@/components/myhome/ScanButton";
import { ApplianceList } from "@/components/myhome/ApplianceList";
import { AddApplianceForm, type ScanPrefill } from "@/components/myhome/AddApplianceForm";
import {
  ImportBillButton,
  ImportBillSummary,
  useBillImport,
} from "@/components/myhome/ImportBillCard";
import { DeveloperSettings } from "@/components/myhome/DeveloperSettings";

type Filter = ApplianceType | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ev", label: "EV" },
  { value: "hvac", label: "HVAC" },
  { value: "kitchen", label: "Kitchen" },
  { value: "laundry", label: "Laundry" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

export default function MyHomePage() {
  const [appliances, setAppliances] = useState<Appliance[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const reduce = useReducedMotion();
  const fade = reduce ? noMotion : enter;

  useEffect(() => {
    let alive = true;
    getAppliances().then((list) => {
      if (alive) setAppliances(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Set after a scan the model couldn't identify — opens manual entry prefilled.
  const [scanPrefill, setScanPrefill] = useState<ScanPrefill | null>(null);

  function prepend(a: Appliance) {
    // New scans / manual adds land at the top so the enter animation is seen.
    setAppliances((prev) => (prev ? [a, ...prev] : [a]));
  }

  const scan = useScan(prepend, (suggestion, note) =>
    setScanPrefill({
      name: suggestion.name,
      type: suggestion.type,
      kw: suggestion.kw,
      photo: suggestion.photo,
      note:
        note ||
        suggestion.note ||
        "The scan couldn't identify this device — confirm the details and add it.",
    }),
  );
  const bill = useBillImport();

  const filtered = useMemo(() => {
    if (!appliances) return [];
    if (filter === "all") return appliances;
    return appliances.filter((a) => a.type === filter);
  }, [appliances, filter]);

  async function handleDelete(id: string) {
    setAppliances((prev) => (prev ? prev.filter((a) => a.id !== id) : prev)); // optimistic
    try {
      await deleteAppliance(id);
    } catch {
      // Rollback: re-fetch the authoritative list.
      const fresh = await getAppliances();
      setAppliances(fresh);
    }
  }

  return (
    <Screen className="pb-8">
      <motion.header className="mb-4" variants={fade} initial="hidden" animate="show">
        <h1 className="text-2xl font-bold tracking-tight text-ink">My Home</h1>
        <p className="mt-0.5 text-sm text-sub">
          The appliances the agent plans around. Add what you have — it does the rest.
        </p>
      </motion.header>

      {/* Scan (primary) + Upload photo + Import bill — equal-width row.
          Stacks to full-width on very small screens. Panels render below the row. */}
      <div className="flex flex-wrap gap-2 max-[340px]:flex-col">
        <ScanButton
          scanning={scan.scanning}
          onCapture={scan.openCamera}
          cameraRef={scan.cameraRef}
          cameraId={scan.cameraId}
          handleFile={scan.handleFile}
          className="flex-1 min-w-[140px]"
        />
        <UploadPhotoButton
          inputRef={scan.inputRef}
          inputId={scan.inputId}
          scanning={scan.scanning}
          onOpen={scan.openUpload}
          handleFile={scan.handleFile}
          className="flex-1 min-w-[140px]"
        />
        <ImportBillButton
          inputRef={bill.inputRef}
          inputId={bill.inputId}
          phase={bill.phase}
          onOpen={bill.open}
          handleFile={bill.handleFile}
          className="flex-1 min-w-[140px]"
        />
      </div>
      <p className="mt-2 text-xs text-sub">
        The agent reads your bill to learn your habits and plan around your rate plan.
      </p>

      <ScanSweep
        scanning={scan.scanning}
        previewUrl={scan.previewUrl}
        error={scan.error}
        notice={scan.notice}
      />
      <ImportBillSummary inputId={bill.inputId} phase={bill.phase} summary={bill.summary} />

      <div className="mt-5">
        <SectionHeader title="Your appliances" />

        {/* Filter chips */}
        <motion.div
          className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          variants={fade}
          initial="hidden"
          animate="show"
        >
          <div className="flex w-max gap-2">
            {FILTERS.map((f) => (
              <Pill
                key={f.value}
                active={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Pill>
            ))}
          </div>
        </motion.div>

        {appliances === null ? (
          <ApplianceListSkeleton />
        ) : (
          <ApplianceList appliances={filtered} onDelete={handleDelete} />
        )}
      </div>

      <div className="mt-4">
        <AddApplianceForm
          onAdded={(a) => {
            setScanPrefill(null); // handoff complete — clear the scan hint
            prepend(a);
          }}
          prefill={scanPrefill}
        />
      </div>

      {/* Tap "Powerfly · local build" 5× to open live API logging / base URL. */}
      <DeveloperSettings />
    </Screen>
  );
}

function ApplianceListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-md bg-card shadow-soft" />
      ))}
    </div>
  );
}
