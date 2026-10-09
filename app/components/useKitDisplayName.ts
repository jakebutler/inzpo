"use client";

import { useEffect, useReducer } from "react";
import { isRecentPendingBrief, STALE_PENDING_MS } from "@/lib/brief-state";
import { kitDisplayName, type KitNameInput } from "@/lib/kit-name";

/** Expire a placeholder even when no poll or navigation causes another render. */
export function useKitDisplayName(input: KitNameInput): string {
  const [, expire] = useReducer((n: number) => n + 1, 0);
  const { status, updatedAt, stub } = input.brief ?? {};
  const hasBrief = input.brief !== undefined;
  const createdAt = input.createdAt == null ? undefined : new Date(input.createdAt).getTime();
  useEffect(() => {
    const startedAt = !hasBrief ? createdAt
      : status === "pending" && updatedAt != null && isRecentPendingBrief({ status, updatedAt, stub }) ? updatedAt : undefined;
    if (startedAt == null || !Number.isFinite(startedAt) || Date.now() - startedAt >= STALE_PENDING_MS) return;
    const timer = window.setTimeout(expire, startedAt + STALE_PENDING_MS - Date.now());
    return () => window.clearTimeout(timer);
  }, [status, updatedAt, stub, createdAt, hasBrief]);
  return kitDisplayName(input);
}
