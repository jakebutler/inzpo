import { describe, expect, it, afterEach } from "vitest";
import { LEGACY_OWNER_ID, ownerIdsFor } from "@/lib/auth/owner-ids";
import { classifyAuthError, INVITE_ONLY_MESSAGE, messageForAuthError } from "@/lib/auth/clerk-errors";

describe("ownerIdsFor", () => {
  afterEach(() => {
    delete process.env.JAKE_OWNER_ID;
  });

  it("returns only the signed-in user by default", () => {
    expect(ownerIdsFor("user_abc")).toEqual(["user_abc"]);
  });

  it("lets Jake also see legacy-jake rows", () => {
    process.env.JAKE_OWNER_ID = "user_jake";
    expect(ownerIdsFor("user_jake")).toEqual(["user_jake", LEGACY_OWNER_ID]);
    expect(ownerIdsFor("user_friend")).toEqual(["user_friend"]);
  });
});

describe("classifyAuthError", () => {
  it("maps restricted sign-up to invite-only without naming the email", () => {
    expect(classifyAuthError({ code: "sign_up_restricted" })).toBe("invite-only");
    expect(messageForAuthError("invite-only")).toBe(INVITE_ONLY_MESSAGE);
    expect(INVITE_ONLY_MESSAGE.toLowerCase()).not.toContain("@");
  });

  it("maps bad OTP separately", () => {
    expect(classifyAuthError({ errors: [{ code: "form_code_incorrect" }] })).toBe("invalid-code");
  });

  it("does not leak identifier-not-found as a different message", () => {
    expect(messageForAuthError(classifyAuthError({ code: "form_identifier_not_found" }))).toBe(INVITE_ONLY_MESSAGE);
  });
});
