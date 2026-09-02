import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function passphraseMatches(candidate: string): boolean {
  const expected = process.env.AUTH_PASSPHRASE ?? "";
  if (expected.length === 0) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}
