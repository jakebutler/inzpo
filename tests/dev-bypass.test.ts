import { afterEach, describe, expect, it } from "vitest";
import { TEST_OWNER_ID } from "@/lib/auth/owner-ids";

async function loadBypass() {
  return import("@/lib/auth/dev-bypass");
}

describe("dev auth bypass", () => {
  const origAuth = process.env.INZPO_DEV_AUTH;
  const origOwner = process.env.INZPO_DEV_OWNER_ID;
  const origVercel = process.env.VERCEL_ENV;

  afterEach(() => {
    if (origAuth === undefined) delete process.env.INZPO_DEV_AUTH;
    else process.env.INZPO_DEV_AUTH = origAuth;
    if (origOwner === undefined) delete process.env.INZPO_DEV_OWNER_ID;
    else process.env.INZPO_DEV_OWNER_ID = origOwner;
    if (origVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = origVercel;
  });

  it("is off unless INZPO_DEV_AUTH=1", async () => {
    delete process.env.INZPO_DEV_AUTH;
    delete process.env.VERCEL_ENV;
    const { isDevAuthBypassEnabled, devOwnerId } = await loadBypass();
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(devOwnerId()).toBeNull();
  });

  it("never enables on Vercel production", async () => {
    process.env.INZPO_DEV_AUTH = "1";
    process.env.VERCEL_ENV = "production";
    const { isDevAuthBypassEnabled, devOwnerId } = await loadBypass();
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(devOwnerId()).toBeNull();
  });

  it("returns the test owner locally when enabled", async () => {
    process.env.INZPO_DEV_AUTH = "1";
    delete process.env.VERCEL_ENV;
    delete process.env.INZPO_DEV_OWNER_ID;
    const { isDevAuthBypassEnabled, devOwnerId } = await loadBypass();
    expect(isDevAuthBypassEnabled()).toBe(true);
    expect(devOwnerId()).toBe(TEST_OWNER_ID);
  });
});
