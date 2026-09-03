"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capture } from "./actions";
import { TagTray, type TrayFacet } from "./TagTray";
import { autoTagsFor, relevantFacetsFor } from "@/lib/relevance";
import type { ItemKind } from "@/lib/db/schema";

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

interface Preview {
  kind: ItemKind;
  title: string | null;
  image: string | null;
  host: string | null;
}

const KIND_LABEL: Record<string, string> = {
  url: "URL",
  screenshot: "Screenshot",
  photo: "Photo",
  palette: "Palette",
  article: "Article",
  video: "Video",
};

export function CaptureForm({
  facets,
  prefilledUrl,
  shareToken,
}: {
  facets: TrayFacet[];
  prefilledUrl: string;
  shareToken: string | null;
}) {
  const [urlDraft, setUrlDraft] = useState(prefilledUrl);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSubstance = !!preview || !!file || !!shareToken;
  const kind: ItemKind = preview?.kind ?? (file && /screenshot/i.test(file.name) ? "screenshot" : file ? "photo" : "url");
  const relevantNames = relevantFacetsFor(kind);
  const autoTags = hasSubstance && !file ? autoTagsFor(kind) : [];

  function pick(next: File | null) {
    setFile(next);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    });
    setPreview(null);
  }

  function onUrlChange(value: string) {
    setUrlDraft(value);
    if (debounce.current) clearTimeout(debounce.current);
    const clean = value.trim();
    if (!clean) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    if (!/^https?:\/\//i.test(clean)) return;
    setPreviewLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: clean }),
        });
        if (!res.ok) throw new Error("preview failed");
        const body = (await res.json()) as Preview & { ok: boolean };
        setPreview({ kind: body.kind, title: body.title, image: body.image, host: body.host });
      } catch {
        setPreview({ kind: "url", title: null, image: null, host: safeHost(clean) });
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
  }

  // auto-detect from a pasted value even without trailing input events (paste via menu)
  useEffect(() => {
    if (prefilledUrl) onUrlChange(prefilledUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form action={capture} className="pb-4">
      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {shareToken ? <input type="hidden" name="shareToken" value={shareToken} /> : null}

      <div className="flex gap-2">
        <Input
          type="url"
          name="url"
          inputMode="url"
          autoFocus={!prefilledUrl}
          value={urlDraft}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="Paste a link to capture it…"
          className="h-12 rounded-xl text-base"
        />
        <Button type="submit" size="lg" className="h-12 rounded-xl px-4" aria-label="Capture">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <DuplicateNoticeInline url={urlDraft} />

      <AnimatePresence initial={false}>
        {!hasSubstance ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                dragging ? "border-ring bg-accent" : "border-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              <span className="text-3xl" aria-hidden>
                ⬆
              </span>
              <span className="text-sm text-muted-foreground">or drop an image here, tap to pick</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="mt-3"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {fileUrl ? (
                <img src={fileUrl} alt="Captured image" className="max-h-72 w-full object-cover" />
              ) : preview?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image} alt="" className="max-h-72 w-full object-cover" />
              ) : null}
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {preview?.title ?? file?.name ?? "Untitled"}
                  </p>
                  {preview?.host ? <p className="truncate text-xs text-muted-foreground">{preview.host}</p> : null}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {KIND_LABEL[kind] ?? kind} · auto
                </Badge>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.12 }}
              className="mt-5"
            >
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tag it — relevant categories first
              </h2>
              <TagTray
                key={`tray-${preview?.title ?? file?.name ?? "x"}`}
                facets={facets}
                relevantNames={relevantNames}
                autoTags={autoTags}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        size="lg"
        className="sticky bottom-4 mt-6 h-12 w-full rounded-xl text-base font-medium shadow-lg shadow-black/40"
      >
        Save
      </Button>
    </form>
  );
}

function DuplicateNoticeInline({ url }: { url: string }) {
  const [existing, setExisting] = useState<{ itemId: string; title: string | null } | null>(null);

  useEffect(() => {
    if (!url.trim()) {
      setExisting(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/duplicate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
        .then(async (res) => {
          const body = (await res.json()) as { existing: { itemId: string; title: string | null } | null };
          setExisting(body.existing);
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [url]);

  return (
    <AnimatePresence>
      {existing ? (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          Already saved{existing.title ? `: “${existing.title}”` : ""} —{" "}
          <Link href={`/items/${existing.itemId}`} className="underline">
            View existing
          </Link>{" "}
          (saving again is fine)
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
