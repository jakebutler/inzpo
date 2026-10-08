"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CaptureMascotLayer } from "@/app/components/CaptureMascotLayer";
import { prepareUploadFile } from "@/lib/client-image";
import { MOTION, MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { capture } from "./actions";

gsap.registerPlugin(useGSAP);

export function CaptureForm({
  shareToken,
  firstOpen = false,
}: {
  shareToken: string | null;
  firstOpen?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(shareToken);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hasSubstance = !!file || !!shareToken;

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
    setFile(next);
    setUploadKey(shareToken);
    setUploadError(null);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    });
    if (!next) return;
    setUploading(true);
    try {
      const prepared = await prepareUploadFile(next);
      if (prepared.mime === "image/jpeg" && prepared.blob !== next) {
        setFileUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(prepared.blob);
        });
      }
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
      setUploadKey(signed.key);
      queueMicrotask(() => formRef.current?.requestSubmit());
    } catch {
      setUploadError("That photo could not be uploaded. Try another.");
      setUploadKey(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} action={capture} className="pb-4">
      <CaptureMascotLayer firstOpen={firstOpen} hasSubstance={hasSubstance} uploading={uploading} />
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

      {hasSubstance ? (
        <div ref={stageRef}>
          <div data-stage="preview-card" className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            {fileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Captured image" className="max-h-72 w-full object-cover" />
            ) : null}
            <div className="p-3">
              <p className="truncate text-sm font-medium">{uploading ? "Uploading…" : file?.name ?? "Shared photo"}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl border-t border-border bg-background/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground"
          style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
        >
          Snap something
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          className="mt-2 min-h-11 w-full text-sm text-muted-foreground"
        >
          Pick a photo
        </button>
      </div>
    </form>
  );
}
