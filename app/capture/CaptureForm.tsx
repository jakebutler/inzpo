"use client";

import { useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CaptureMascotLayer } from "@/app/components/CaptureMascotLayer";
import { MascotStage } from "@/app/components/MascotStage";
import { prepareUploadFile } from "@/lib/client-image";
import { buildCaptureFormData } from "@/lib/capture-form-data";
import { MASCOT_SIZE_UPLOAD_PX } from "@/lib/mascot";
import { MOTION, MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { BAR_FADE, SNAP_SCROLL_PAD } from "@/lib/layout";
import { unstable_rethrow } from "next/navigation";
import { capture } from "./actions";

gsap.registerPlugin(useGSAP);

export function CaptureForm({
  shareToken,
  firstOpen = false,
  children,
}: {
  shareToken: string | null;
  firstOpen?: boolean;
  children?: ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(shareToken);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"reading" | "uploading" | "saving" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const uploadKeyRef = useRef<string | null>(shareToken);
  const hasSubstance = !!file || !!shareToken || uploading;

  useGSAP(
    () => {
      if (!hasSubstance) return;
      if (prefersReducedMotion()) return;
      gsap.from("[data-stage='preview-card']", {
        opacity: 0,
        y: 24,
        duration: MOTION.enter.duration,
        ease: MOTION.enter.ease,
      });
    },
    { scope: stageRef, dependencies: [hasSubstance, file?.name] },
  );

  async function pick(next: File | null) {
    setUploadError(null);
    if (!next) {
      setFile(null);
      setUploadKey(shareToken);
      uploadKeyRef.current = shareToken;
      setUploading(false);
      setUploadPhase(null);
      setFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setUploading(true);
    setUploadPhase("reading");
    setFile(next);
    setUploadKey(shareToken);
    uploadKeyRef.current = shareToken;
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    });
    try {
      const prepared = await prepareUploadFile(next);
      if (prepared.mime === "image/jpeg" && prepared.blob !== next) {
        setFileUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(prepared.blob);
        });
      }
      setUploadPhase("uploading");
      const res = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: prepared.mime, bytes: prepared.blob.size }),
      });
      if (!res.ok) throw new Error("Could not start upload");
      const signed = (await res.json()) as { url: string; key: string; contentType: string };
      const put = await fetch(signed.url, {
        method: "PUT",
        headers: { "Content-Type": signed.contentType },
        body: prepared.blob,
      });
      if (!put.ok) throw new Error("Upload failed");
      uploadKeyRef.current = signed.key;
      setUploadKey(signed.key);
      setUploadPhase("saving");
      const key = uploadKeyRef.current;
      if (!key) throw new Error("Could not start upload");
      await capture(buildCaptureFormData({ uploadKey: key, filename: next.name, shareToken }));
    } catch (err) {
      unstable_rethrow(err);
      const message = err instanceof Error ? err.message : "";
      if (/could not read/i.test(message)) {
        window.location.assign("/capture?error=bad-image");
        return;
      }
      setUploadError("That photo didn't upload. Try again, or pick another.");
      setUploadKey(null);
      uploadKeyRef.current = null;
      setUploading(false);
      setUploadPhase(null);
    }
  }

  const progressCopy =
    uploadPhase === "reading" ? "Reading photo…" : uploadPhase === "uploading" ? "Uploading…" : uploadPhase === "saving" ? "Saving kit…" : null;

  return (
    <form style={{ paddingBottom: SNAP_SCROLL_PAD }} aria-busy={uploading || undefined}>
      {uploading ? (
        <div
          data-upload-wait
          className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-background px-6"
        >
          <MascotStage
            moment="upload"
            snapReady
            immediate
            size={MASCOT_SIZE_UPLOAD_PX}
            align="center"
            progress={progressCopy}
          />
        </div>
      ) : (
        <CaptureMascotLayer firstOpen={firstOpen} hasSubstance={hasSubstance} />
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      {uploadKey ? <input type="hidden" name="uploadKey" value={uploadKey} /> : null}
      {file ? <input type="hidden" name="filename" value={file.name} /> : null}
      {shareToken && !uploadKey ? <input type="hidden" name="shareToken" value={shareToken} /> : null}
      {uploadError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {uploadError}
        </p>
      ) : null}

      {!hasSubstance ? children : null}

      {hasSubstance ? (
        <div ref={stageRef}>
          <div data-stage="preview-card" className="mt-3 overflow-hidden">
            {fileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Captured image" className="max-h-72 w-full object-cover" />
            ) : null}
            <p className="mt-2 truncate text-base">{uploading ? progressCopy ?? "Uploading…" : file?.name ?? "Shared photo"}</p>
          </div>
        </div>
      ) : null}

      <div data-snap-bar className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-full h-12"
          style={{ background: BAR_FADE }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="h-14 w-full bg-primary text-base font-medium text-primary-foreground disabled:opacity-40"
          style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
        >
          Snap something
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          disabled={uploading}
          className="mt-2 min-h-11 w-full text-base disabled:opacity-40"
        >
          Pick a photo
        </button>
      </div>
    </form>
  );
}
