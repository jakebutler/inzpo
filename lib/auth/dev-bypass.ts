import { TEST_OWNER_ID } from "@/lib/auth/owner-ids";

/**
 * Local/preview-only auth bypass for QA screenshots.
 * Never on Vercel production. Requires INZPO_DEV_AUTH=1.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.INZPO_DEV_AUTH === "1";
}

/** /dev/qa and /dev/fold: local `next dev`, or DEV_ROUTES=1. Never on Vercel production. */
export function isDevRoutesEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.DEV_ROUTES === "1") return true;
  return process.env.NODE_ENV === "development";
}

/** /dev/fold and /dev/qa. Preview 404s unless DEV_ROUTES=1. */
export function isFoldQaEnabled(): boolean {
  return isDevRoutesEnabled();
}

export function devOwnerId(): string | null {
  if (!isDevAuthBypassEnabled()) return null;
  const id = process.env.INZPO_DEV_OWNER_ID?.trim();
  return id && id.length > 0 ? id : TEST_OWNER_ID;
}
