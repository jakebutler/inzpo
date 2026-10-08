"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUp } from "lucide-react";
import { SubmitButton } from "@/app/components/SubmitButton";
import { CaptureMascotLayer } from "@/app/components/CaptureMascotLayer";
import { prepareUploadFile } from "@/lib/client-image";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    } catch {
      setUploadError("That photo could not be uploaded. Try another.");
      setUploadKey(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={capture} className="pb-4">
      <CaptureMascotLayer firstOpen={firstOpen} hasSubstance={hasSubstance} uploading={uploading} />
      <input
        ref={inputRef}
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
              <p className="truncate text-sm font-medium">{file?.name ?? "Shared photo"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Pick a photo"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pick(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-ring bg-accent" : "border-border bg-card hover:border-muted-foreground/40"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ArrowUp className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="text-sm text-muted-foreground">Pick a photo, or drop one here</span>
          </button>
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-background/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <SubmitButton
          size="lg"
          className="h-14 w-full rounded-xl text-base font-medium"
          pendingLabel="Saving…"
          disabled={uploading || (!uploadKey && !shareToken && !file)}
        >
          Snap something
        </SubmitButton>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 min-h-11 w-full text-sm text-muted-foreground"
        >
          Pick a photo
        </button>
      </div>
    </form>
  );
}
