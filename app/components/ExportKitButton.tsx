"use client";

import { useState } from "react";

export function ExportKitButton({
  itemId,
  collectionId,
}: {
  itemId?: string;
  collectionId?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const href = collectionId ? `/api/collections/${collectionId}/export` : `/api/kits/${itemId ?? ""}/export`;
  const filename = collectionId ? "collection.zip" : "kit.zip";
  const label = collectionId ? "Export collection" : "Export kit";

  async function exportKit() {
    setNote(null);
    const res = await fetch(href);
    if (!res.ok) {
      setNote("Couldn't export. Try again.");
      return;
    }
    const blob = await res.blob();
    const file = new File([blob], filename, { type: "application/zip" });
    const payload = { files: [file] };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share({ files: [file], title: label });
        setNote("share");
        return;
      } catch {
        // iOS often rejects application/zip; fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setNote("download");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void exportKit()}
        className="inline-flex min-h-11 items-center border border-current px-4 text-base"
        data-export-path={note ?? ""}
      >
        {label}
      </button>
      {note ? (
        <p className="text-[11px] text-muted-foreground" data-export-path={note}>
          {note === "share" ? "Shared" : note === "download" ? "Downloaded" : note}
        </p>
      ) : null}
    </div>
  );
}
