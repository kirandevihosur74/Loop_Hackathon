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
 * image it plays a sweep for the WHOLE inference round-trip, then awaits
 * scanAppliance(file?) and branches on the result:
 * - identified → hands the appliance up to the parent to prepend to the list.
 * - server replied but couldn't identify → onUnidentified(suggestion, note) so
 *   the parent can open the manual Add Appliance form prefilled (no dead end).
 * - network / endpoint failure → an explicit "couldn't reach" error (never the
 *   "couldn't identify" copy — that would blame the photo for an outage).
 *
 * Upload photo sends the image to the backend inference path; Scan appliance
 * without a file stays on the mock rotating pool.
 */
export function useScan(onScanned: (a: Appliance) => void) {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);   // gallery / files
  const cameraRef = useRef<HTMLInputElement>(null);  // live camera (capture)
  const inputId = useId();
  const cameraId = useId();
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function detect(file: File | null, nextPreview: string | null = null) {
    if (scanning) return;
    setScanning(true);
    setError(null);
    setNotice(null);
    setPreviewUrl(nextPreview);
    // Keep the sweep visible at least this long — success OR failure — so a
    // fast server reply (or an instant network error) never flashes the UI.
    const minSweep = reduce
      ? Promise.resolve()
      : new Promise((r) => setTimeout(r, 1500));
    try {
      const result = await scanAppliance(file ?? undefined);
      await minSweep;
      // Always add the device — even an unsure scan lands as a best guess that
      // the refine loop then improves (no dead-end manual entry).
      onScanned(result.appliance);
      if (result.approximate) {
        setNotice("Added as a best guess — refining the details…");
      }
    } catch {
      // Network / endpoint failure — the server never returned a scan verdict.
      await minSweep;
      setError(
        file
          ? "Couldn't reach the scan service — check your connection and try again, or add the appliance manually below."
          : "Scan failed — try again in a moment.",
      );
    } finally {
      setScanning(false);
      if (nextPreview) URL.revokeObjectURL(nextPreview);
      setPreviewUrl(null);
    }
  }

  // "Scan appliance" → open the device camera (capture input). On desktop browsers,
  // where there is no camera, this falls back to a normal file picker.
  function openCamera() {
    if (scanning) return;
    cameraRef.current?.click();
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
    notice,
    previewUrl,
    inputRef,
    inputId,
    cameraRef,
    cameraId,
    openCamera,
    openUpload,
    handleFile,
  };
}

/** The primary (filled gold) trigger — opens the live camera via a capture input. */
export function ScanButton({
  scanning,
  onCapture,
  cameraRef,
  cameraId,
  handleFile,
  className,
}: {
  scanning: boolean;
  onCapture: () => void;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  cameraId: string;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <>
      {/* capture="environment" asks the OS for the rear camera; browsers/WebViews
          without a camera fall back to a file picker. */}
      <input
        ref={cameraRef}
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="sr-only"
        aria-label="Take a photo of an appliance"
      />

      <PrimaryButton
        onClick={onCapture}
        disabled={scanning}
        aria-busy={scanning}
        className={className}
      >
        <CameraIcon />
        {scanning ? "Scanning…" : "Scan appliance"}
      </PrimaryButton>
    </>
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

/** The simulated-scan viewfinder sweep — renders full-width below the row.
 * Stays mounted for the entire inference round-trip (useScan keeps `scanning`
 * true until the server replies or fails). */
export function ScanSweep({
  scanning,
  previewUrl,
  error,
  notice,
}: {
  scanning: boolean;
  previewUrl?: string | null;
  error?: string | null;
  notice?: string | null;
}) {
  const reduce = useReducedMotion();
  const statusLabel = previewUrl ? "Analyzing photo…" : "Detecting appliance…";

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
            role="status"
            aria-live="polite"
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
                    <span className="text-sm font-semibold text-sub">{statusLabel}</span>
                  </div>
                ) : (
                  <>
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
                    <span className="absolute inset-x-0 bottom-1.5 text-center text-xs font-semibold text-sub">
                      {statusLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
            {previewUrl && (
              <p className="mt-1.5 text-xs text-sub">
                Analyzing photo — identifying the appliance can take up to a minute.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && !scanning && (
        <p className="mt-2 text-xs text-peak" role="alert">
          {error}
        </p>
      )}

      {notice && !error && !scanning && (
        <p className="mt-2 text-xs text-sub" role="status">
          {notice}
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
