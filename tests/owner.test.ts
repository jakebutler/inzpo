import { describe, expect, it, afterEach } from "vitest";
import { LEGACY_OWNER_ID, ownerIdsFor } from "@/lib/auth/owner-ids";
import { classifyAuthError, INVITE_ONLY_MESSAGE, RETRY_MESSAGE, messageForAuthError } from "@/lib/auth/clerk-errors";

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

  it("uses a generic retry line for unknown, network, and rate-limit errors", () => {
    expect(classifyAuthError({ code: "too_many_requests" })).toBe("retry");
    expect(classifyAuthError({ code: "network_error" })).toBe("retry");
    expect(classifyAuthError({ message: "fetch failed" })).toBe("retry");
    expect(messageForAuthError("retry")).toBe(RETRY_MESSAGE);
    expect(messageForAuthError(classifyAuthError({ code: "something_else" }))).toBe(RETRY_MESSAGE);
    expect(RETRY_MESSAGE).not.toBe(INVITE_ONLY_MESSAGE);
  });
});
