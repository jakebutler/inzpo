import { describe, expect, it, beforeEach, vi } from "vitest";
import { passphraseMatches } from "@/lib/auth/passphrase";

describe("passphraseMatches", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_PASSPHRASE", "correct horse battery staple");
  });

  it("accepts the configured passphrase", () => {
    expect(passphraseMatches("correct horse battery staple")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(passphraseMatches("wrong")).toBe(false);
    expect(passphraseMatches("")).toBe(false);
  });

  it("rejects everything when no passphrase is configured", () => {
    vi.stubEnv("AUTH_PASSPHRASE", "");
    expect(passphraseMatches("")).toBe(false);
  });
});
