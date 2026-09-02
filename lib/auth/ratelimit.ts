const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  return recent.length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  failures.set(key, recent);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function clientKey(ip: string | null): string {
  return ip ?? "unknown";
}
