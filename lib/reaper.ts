export const TMP_PREFIX = "tmp/";
export const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface TmpObject {
  key: string;
  lastModified?: Date;
}

// Pure: which tmp/ objects are older than the cutoff. Objects without a
// timestamp are skipped — the lifecycle rule backs those up.
export function selectExpiredTmp(objects: TmpObject[], now: Date, maxAgeMs = TMP_MAX_AGE_MS): string[] {
  return objects
    .filter((o) => {
      if (!o.key.startsWith(TMP_PREFIX)) return false;
      if (!o.lastModified) return false;
      return now.getTime() - o.lastModified.getTime() > maxAgeMs;
    })
    .map((o) => o.key);
}
