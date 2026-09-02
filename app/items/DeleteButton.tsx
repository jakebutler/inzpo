"use client";

import { useState } from "react";
import { deleteItemAction } from "./actions";

export function DeleteButton({ itemId, title }: { itemId: string; title: string | null }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-red-400 hover:text-red-300 min-h-[36px]"
      >
        Delete…
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-400">Delete “{title ?? "Untitled"}” forever?</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs min-h-[36px]"
      >
        Cancel
      </button>
      <form action={deleteItemAction}>
        <input type="hidden" name="id" value={itemId} />
        <button
          type="submit"
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white min-h-[36px]"
        >
          Delete
        </button>
      </form>
    </span>
  );
}
