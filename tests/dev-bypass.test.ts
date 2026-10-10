import { afterEach, describe, expect, it } from "vitest";
import { TEST_OWNER_ID } from "@/lib/auth/owner-ids";

async function loadBypass() {
  return import("@/lib/auth/dev-bypass");
}

describe("dev auth bypass", () => {
  const origAuth = process.env.INZPO_DEV_AUTH;
  const origOwner = process.env.INZPO_DEV_OWNER_ID;
  const origVercel = process.env.VERCEL_ENV;
  const origDevRoutes = process.env.DEV_ROUTES;

  afterEach(() => {
    if (origAuth === undefined) delete process.env.INZPO_DEV_AUTH;
    else process.env.INZPO_DEV_AUTH = origAuth;
    if (origOwner === undefined) delete process.env.INZPO_DEV_OWNER_ID;
    else process.env.INZPO_DEV_OWNER_ID = origOwner;
    if (origVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = origVercel;
    if (origDevRoutes === undefined) delete process.env.DEV_ROUTES;
    else process.env.DEV_ROUTES = origDevRoutes;
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

  it("404s /dev on Preview unless DEV_ROUTES=1 or local development", async () => {
    delete process.env.INZPO_DEV_AUTH;
    delete process.env.DEV_ROUTES;
    process.env.VERCEL_ENV = "preview";
    const { isDevAuthBypassEnabled, isFoldQaEnabled, isDevRoutesEnabled } = await loadBypass();
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(isFoldQaEnabled()).toBe(false);
    expect(isDevRoutesEnabled()).toBe(false);
    process.env.DEV_ROUTES = "1";
    expect(isFoldQaEnabled()).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(isFoldQaEnabled()).toBe(false);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    expect(readFileSync(join(process.cwd(), "lib/auth/dev-bypass.ts"), "utf8")).toContain(
      'process.env.NODE_ENV === "development"',
    );
  });
});

describe("preview /dev fold does not skip Clerk context", () => {
  it("still runs clerkMiddleware on /dev so layout auth() cannot 500", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(mw).toContain("if (isDevQaRoute(request)) return;");
    expect(mw).not.toMatch(/if \(isFoldQaEnabled\(\) && isDevQaRoute\(request\)\) return NextResponse\.next\(\);/);
    expect(mw).toContain("return clerkHandler(request, event as never)");
    expect(mw).toContain('"/media/(.*)"');
    expect(mw).toMatch(/jpe\?g/);
    expect(mw).toMatch(/png/);
    const owner = readFileSync(join(process.cwd(), "lib/auth/owner.ts"), "utf8");
    expect(owner).toContain("auth() failed without clerkMiddleware");
  });
});
