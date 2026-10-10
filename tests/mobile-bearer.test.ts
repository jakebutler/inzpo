import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyToken: vi.fn(), devOwnerId: vi.fn(), isClerkConfigured: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("@/lib/auth/dev-bypass", () => ({ devOwnerId: mocks.devOwnerId }));
vi.mock("@/lib/auth/clerk-configured", () => ({ isClerkConfigured: mocks.isClerkConfigured }));

import { ownerIdFromBearer, requireMobileOwner } from "@/lib/auth/bearer";

function request(header?: string): Request {
  return new Request("https://inzpo.test/api/mobile/collections", { headers: header ? { Authorization: header } : {} });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.devOwnerId.mockReturnValue(null);
  mocks.isClerkConfigured.mockReturnValue(true);
  mocks.verifyToken.mockRejectedValue(new Error("Invalid token"));
  vi.stubEnv("CLERK_SECRET_KEY", "test-secret");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("mobile bearer authentication", () => {
  it.each([undefined, "garbage", "Basic abc", "Bearer", "Bearer token extra"])("rejects a missing or malformed header (%s)", async (header) => {
    expect(await ownerIdFromBearer(request(header))).toBeNull();
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  it("returns null when verification fails", async () => {
    expect(await ownerIdFromBearer(request("Bearer garbage"))).toBeNull();
  });

  it("returns the verified subject and passes the secret key to Clerk", async () => {
    mocks.verifyToken.mockResolvedValue({ sub: "user_1" });
    expect(await ownerIdFromBearer(request("Bearer signed.jwt.token"))).toBe("user_1");
    expect(mocks.verifyToken).toHaveBeenCalledWith("signed.jwt.token", { secretKey: "test-secret" });
  });

  it("accepts the case-insensitive Bearer scheme", async () => {
    mocks.verifyToken.mockResolvedValue({ sub: "user_1" });
    expect(await ownerIdFromBearer(request("bearer signed.jwt.token"))).toBe("user_1");
  });

  it.each([{}, { sub: "" }, { sub: 12 }])("rejects a payload without a usable subject", async (payload) => {
    mocks.verifyToken.mockResolvedValue(payload);
    expect(await ownerIdFromBearer(request("Bearer token"))).toBeNull();
  });

  it("does not verify tokens when Clerk is unconfigured", async () => {
    mocks.isClerkConfigured.mockReturnValue(false);
    expect(await ownerIdFromBearer(request("Bearer token"))).toBeNull();
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  it("uses the dev bypass before checking configuration or the header", async () => {
    mocks.devOwnerId.mockReturnValue("dev_owner");
    mocks.isClerkConfigured.mockReturnValue(false);
    expect(await ownerIdFromBearer(request())).toBe("dev_owner");
    expect(mocks.isClerkConfigured).not.toHaveBeenCalled();
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  it("returns a JSON 401 without a login redirect", async () => {
    const result = await requireMobileOwner(request());
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
      expect(result.headers.get("location")).toBeNull();
      expect(await result.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("returns an owner for authorized handlers", async () => {
    mocks.verifyToken.mockResolvedValue({ sub: "user_1" });
    expect(await requireMobileOwner(request("Bearer token"))).toEqual({ ownerId: "user_1" });
  });
});
