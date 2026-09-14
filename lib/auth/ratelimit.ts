const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;
const SHARE_WINDOW_MS = 60 * 60 * 1000;
const MAX_SHARE_UPLOADS = 10;

const failures = new Map<string, number[]>();
const shareUploads = new Map<string, number[]>();

function recent(hits: Map<string, number[]>, key: string, windowMs: number): number[] {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, list);
  return list;
}

export function isRateLimited(key: string): boolean {
  return recent(failures, key, WINDOW_MS).length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  recent(failures, key, WINDOW_MS).push(Date.now());
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function shareUploadLimited(key: string): boolean {
  return recent(shareUploads, key, SHARE_WINDOW_MS).length >= MAX_SHARE_UPLOADS;
}

export function recordShareUpload(key: string): void {
  recent(shareUploads, key, SHARE_WINDOW_MS).push(Date.now());
}

export function clientKey(ip: string | null): string {
  return ip ?? "unknown";
}
