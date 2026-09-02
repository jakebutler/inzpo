import { describe, expect, it, beforeAll, vi } from "vitest";
import { SignJWT } from "jose";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

beforeAll(() => {
  vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-test-secret-test-secret-32b");
});

describe("session tokens", () => {
  it("roundtrips a signed token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-token")).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
  });

  it("rejects tokens signed with a different secret", async () => {
    const foreign = await new SignJWT({ sub: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode("a-totally-different-secret-value-32b"));
    expect(await verifySessionToken(foreign)).toBe(false);
  });

  it("rejects expired tokens", async () => {
    const expired = await new SignJWT({ sub: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode("test-secret-test-secret-test-secret-32b"));
    expect(await verifySessionToken(expired)).toBe(false);
  });
});
