"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Existing {
  itemId: string;
  title: string | null;
}

export function DuplicateNotice() {
  const [existing, setExisting] = useState<Existing | null>(null);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="url"]');
    if (!input) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const value = input.value.trim();
      if (!value) {
        setExisting(null);
        return;
      }
      fetch("/api/duplicate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      })
        .then(async (res) => {
          const body = (await res.json()) as { existing: Existing | null };
          setExisting(body.existing);
        })
        .catch(() => {});
    };
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 400);
    };
    input.addEventListener("input", onChange);
    input.addEventListener("blur", check);
    return () => {
      input.removeEventListener("input", onChange);
      input.removeEventListener("blur", check);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!existing) return null;
  return (
    <p className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-300" role="status">
      Already saved{existing.title ? `: “${existing.title}”` : ""} —{" "}
      <Link href={`/items/${existing.itemId}`} className="underline">
        View existing
      </Link>{" "}
      (saving again is fine)
    </p>
  );
}
