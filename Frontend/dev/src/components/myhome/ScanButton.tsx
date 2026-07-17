"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GhostButton, PrimaryButton } from "@/components/ui";
import { scanAppliance } from "@/lib/data";
import { cssVar } from "@/lib/tokens";
import { ease } from "@/lib/motion";
import type { Appliance } from "@/lib/types";

/**
 * Scan / photo-upload behavior. On scan() (stub camera) or after picking an
 * image it plays a brief sweep, then awaits scanAppliance(file?) and hands the
 * detected appliance up to the parent to prepend to the list.
 *
 * Upload photo sends the image to the backend inference path; Scan appliance
 * without a file stays on the mock rotating pool.
 */
export function useScan(onScanned: (a: Appliance) => void) {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function detect(file: File | null, nextPreview: string | null = null) {
    if (scanning) return;
    setScanning(true);
    setError(null);
    setPreviewUrl(nextPreview);
    try {
      const minSweep = reduce ? Promise.resolve() : new Promise((r) => setTimeout(r, 1500));
      const [detected] = await Promise.all([
        scanAppliance(file ?? undefined),
        minSweep,
      ]);
      onScanned(detected);
    } catch {
      setError(
        file
          ? "Couldn't identify that appliance. Try a clearer photo or nameplate shot."
          : "Scan failed — try again in a moment.",
      );
    } finally {
      setScanning(false);
      if (nextPreview) URL.revokeObjectURL(nextPreview);
      setPreviewUrl(null);
    }
  }

  function scan() {
    void detect(null);
  }

  function openUpload() {
    if (scanning) return;
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file still fires onChange.
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    void detect(file, URL.createObjectURL(file));
  }

  return {
    scanning,
    error,
    scan,
    previewUrl,
    inputRef,
    inputId,
    openUpload,
    handleFile,
  };
}

/** The primary (filled gold) trigger — lives in the side-by-side action row. */
export function ScanButton({
  scanning,
  onScan,
  className,
}: {
  scanning: boolean;
  onScan: () => void;
  className?: string;
}) {
  return (
    <PrimaryButton
      onClick={onScan}
      disabled={scanning}
      aria-busy={scanning}
      className={className}
    >
      <CameraIcon />
      {scanning ? "Scanning…" : "Scan appliance"}
    </PrimaryButton>
  );
}

/** Secondary photo upload — same detect flow as scan, via a hidden file input. */
export function UploadPhotoButton({
  inputRef,
  inputId,
  scanning,
  onOpen,
  handleFile,
  className,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputId: string;
  scanning: boolean;
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
        accept="image/*"
        onChange={handleFile}
        className="sr-only"
        aria-label="Upload a photo of an appliance"
      />

      <GhostButton
        onClick={onOpen}
        disabled={scanning}
        aria-busy={scanning}
        className={className}
      >
        <UploadIcon />
        {scanning ? "Detecting…" : "Upload photo"}
      </GhostButton>
    </>
  );
}

/** The simulated-scan viewfinder sweep — renders full-width below the row. */
export function ScanSweep({
  scanning,
  previewUrl,
  error,
}: {
  scanning: boolean;
  previewUrl?: string | null;
  error?: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <>
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-md bg-card shadow-soft ring-1 ring-line">
              <div className="relative h-full w-full">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img
                    src={previewUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                )}

                {/* Framing brackets */}
                <div className="pointer-events-none absolute inset-4">
                  <span className="absolute left-0 top-0 h-4 w-4 rounded-tl-sm border-l-2 border-t-2 border-gold" />
                  <span className="absolute right-0 top-0 h-4 w-4 rounded-tr-sm border-r-2 border-t-2 border-gold" />
                  <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-sm border-b-2 border-l-2 border-gold" />
                  <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br-sm border-b-2 border-r-2 border-gold" />
                </div>

                {reduce ? (
                  <div className="relative flex h-full items-center justify-center">
                    <span className="text-sm font-semibold text-sub">Detecting appliance…</span>
                  </div>
                ) : (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-x-6 h-0.5 rounded-pill"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${cssVar.gold}, transparent)`,
                    }}
                    initial={{ top: "18%" }}
                    animate={{ top: ["18%", "82%", "18%"] }}
                    transition={{ duration: 1.4, ease, repeat: Infinity }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && !scanning && (
        <p className="mt-2 text-xs text-peak" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l1-1.6A1 1 0 0 1 9 5h6a1 1 0 0 1 .8.4l1 1.6h1.7A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V7" />
      <path d="M8.5 10.5 12 7l3.5 3.5" />
      <path d="M5 18h14" />
    </svg>
  );
}
