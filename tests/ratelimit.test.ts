import { describe, expect, it } from "vitest";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/auth/ratelimit";

describe("login rate limiter", () => {
  it("allows under the failure threshold and blocks at it", () => {
    const key = `test-${Math.random()}`;
    expect(isRateLimited(key)).toBe(false);
    for (let i = 0; i < 10; i++) recordFailure(key);
    expect(isRateLimited(key)).toBe(true);
  });

  it("clears on success", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 10; i++) recordFailure(key);
    clearFailures(key);
    expect(isRateLimited(key)).toBe(false);
  });
});
