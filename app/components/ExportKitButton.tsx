"use client";

import { useState } from "react";

export function ExportKitButton({ itemId }: { itemId: string }) {
  const [note, setNote] = useState<string | null>(null);

  async function exportKit() {
    setNote(null);
    const res = await fetch(`/api/kits/${itemId}/export`);
    if (!res.ok) {
      setNote("Could not export.");
      return;
    }
    const blob = await res.blob();
    const file = new File([blob], "kit.zip", { type: "application/zip" });
    const payload = { files: [file] };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share({ files: [file], title: "Export kit" });
        setNote("share");
        return;
      } catch {
        // iOS often rejects application/zip; fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kit.zip";
    a.click();
    URL.revokeObjectURL(url);
    setNote("download");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void exportKit()}
        className="min-h-11 text-sm"
        data-export-path={note ?? ""}
      >
        Export kit
      </button>
      {note ? (
        <p className="text-[11px] text-muted-foreground" data-export-path={note}>
          {note === "share" ? "Shared" : note === "download" ? "Downloaded" : note}
        </p>
      ) : null}
    </div>
  );
}
