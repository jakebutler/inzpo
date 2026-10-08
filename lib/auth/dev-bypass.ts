import { TEST_OWNER_ID } from "@/lib/auth/owner-ids";

/**
 * Local/preview-only auth bypass for QA screenshots.
 * Never on Vercel production. Requires INZPO_DEV_AUTH=1.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.INZPO_DEV_AUTH === "1";
}

export function devOwnerId(): string | null {
  if (!isDevAuthBypassEnabled()) return null;
  const id = process.env.INZPO_DEV_OWNER_ID?.trim();
  return id && id.length > 0 ? id : TEST_OWNER_ID;
}
