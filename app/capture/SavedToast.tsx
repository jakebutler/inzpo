"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function SavedToast({ itemId, title }: { itemId: string; title: string | null }) {
  useEffect(() => {
    toast.success(`Saved${title ? ` “${title}”` : ""} ✓`, {
      description: "The capture surface re-armed — keep going.",
      action: {
        label: "View item",
        onClick: () => {
          window.location.href = `/items/${itemId}`;
        },
      },
    });
  }, [itemId, title]);
  return null;
}
