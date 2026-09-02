"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SavedToast({ itemId, title }: { itemId: string; title: string | null }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-40 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 shadow-2xl"
    >
      <span className="text-sm text-neutral-200">Saved{title ? ` “${title}”` : ""} ✓</span>
      <Link
        href={`/items/${itemId}`}
        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 min-h-[32px] flex items-center"
      >
        View item
      </Link>
    </div>
  );
}
