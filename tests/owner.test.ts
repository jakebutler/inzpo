import { describe, expect, it, afterEach } from "vitest";
import { LEGACY_OWNER_ID, ownerIdsFor } from "@/lib/auth/owner-ids";
import {
  ALLOWLIST_MESSAGE,
  CAPTCHA_MESSAGE,
  classifyAuthError,
  INVITE_ONLY_MESSAGE,
  RETRY_MESSAGE,
  messageForAuthError,
} from "@/lib/auth/clerk-errors";

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
  it("maps restricted sign-up and missing identifiers to the allowlist line", () => {
    expect(ALLOWLIST_MESSAGE).toBe("That email isn't on the invite list yet.");
    expect(classifyAuthError({ code: "sign_up_restricted" })).toBe("allowlist");
    expect(classifyAuthError({ code: "not_allowed_access" })).toBe("allowlist");
    expect(classifyAuthError({ message: "identifier not on allowlist" })).toBe("allowlist");
    expect(messageForAuthError("allowlist")).toBe(ALLOWLIST_MESSAGE);
    expect(ALLOWLIST_MESSAGE.toLowerCase()).not.toContain("@");
    expect(messageForAuthError("invite-only")).toBe(INVITE_ONLY_MESSAGE);
    expect(INVITE_ONLY_MESSAGE.toLowerCase()).not.toContain("@");
  });

  it("maps captcha failures to a reload line, not the generic retry", () => {
    expect(CAPTCHA_MESSAGE).toBe("We couldn't verify you're human. Reload the page and try again.");
    expect(classifyAuthError({ code: "captcha_invalid" })).toBe("captcha");
    expect(classifyAuthError({ errors: [{ code: "form_captcha_invalid" }] })).toBe("captcha");
    expect(messageForAuthError(classifyAuthError({ code: "captcha_invalid" }))).toBe(CAPTCHA_MESSAGE);
    expect(CAPTCHA_MESSAGE).not.toBe(RETRY_MESSAGE);
  });

  it("maps bad OTP separately", () => {
    expect(classifyAuthError({ errors: [{ code: "form_code_incorrect" }] })).toBe("invalid-code");
  });

  it("does not leak identifier-not-found as a different message", () => {
    expect(messageForAuthError(classifyAuthError({ code: "form_identifier_not_found" }))).toBe(ALLOWLIST_MESSAGE);
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
