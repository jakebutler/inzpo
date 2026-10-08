/** Shared by title placeholders and recovery of a lost background brief. */
export const STALE_PENDING_MS = 60_000;

export type BriefState = {
  status: "pending" | "ready" | "failed";
  updatedAt: number;
  stub?: boolean;
};

export function isRecentPendingBrief(brief: BriefState | null | undefined, now = Date.now()): boolean {
  return brief?.status === "pending" && !brief.stub && brief.updatedAt > 0 &&
    now - brief.updatedAt < STALE_PENDING_MS;
}
