export const INVITE_ONLY_MESSAGE = "Inzpo is invite-only. Check with Jake.";
export const ALLOWLIST_MESSAGE = "That email isn't on the invite list yet.";
export const CAPTCHA_MESSAGE = "We couldn't verify you're human. Reload the page and try again.";
export const INVALID_CODE_MESSAGE = "That code didn't match. Try again.";
export const OFFLINE_MESSAGE = "You're offline. Connect and try again.";
export const RETRY_MESSAGE = "Couldn't sign you in just now. Try again in a minute.";

export type AuthErrorKind = "invite-only" | "allowlist" | "captcha" | "invalid-code" | "offline" | "retry";

const INVALID_CODE_CODES = new Set([
  "form_code_incorrect",
  "verification_failed",
  "form_param_code_invalid",
]);

const CAPTCHA_CODES = new Set([
  "captcha_invalid",
  "captcha_failed",
  "captcha_missing",
  "requires_captcha",
  "form_captcha_invalid",
  "smart_captcha_failed",
]);

const ALLOWLIST_CODES = new Set([
  "form_identifier_not_found",
  "sign_up_restricted",
  "not_allowed_access",
]);

const INVITE_ONLY_CODES = new Set([
  "invitation_not_found",
  "authorization_invalid",
]);

const RETRY_CODES = new Set([
  "too_many_requests",
  "rate_limit_exceeded",
  "rate_limited",
  "internal_error",
  "internal_clerk_error",
  "network_error",
  "failed_to_fetch",
  "request_timeout",
  "service_unavailable",
]);

function collectCodes(input: unknown): string[] {
  const codes: string[] = [];
  if (!input || typeof input !== "object") return codes;
  const rec = input as Record<string, unknown>;
  if (typeof rec.code === "string") codes.push(rec.code);
  if (Array.isArray(rec.errors)) {
    for (const err of rec.errors) codes.push(...collectCodes(err));
  }
  if (rec.error) codes.push(...collectCodes(rec.error));
  if (typeof rec.message === "string") {
    if (/\bcaptcha\b/i.test(rec.message)) codes.push("captcha_invalid");
    if (/\ballowlist\b/i.test(rec.message)) codes.push("not_allowed_access");
    if (/\b(restricted|invite[- ]only|not allowed)\b/i.test(rec.message)) {
      codes.push("sign_up_restricted");
    }
  }
  return codes;
}

export function classifyAuthError(input: unknown): AuthErrorKind {
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return "offline";
  const codes = collectCodes(input);
  if (codes.some((c) => INVALID_CODE_CODES.has(c))) return "invalid-code";
  if (codes.some((c) => CAPTCHA_CODES.has(c))) return "captcha";
  if (codes.some((c) => ALLOWLIST_CODES.has(c))) return "allowlist";
  if (codes.some((c) => INVITE_ONLY_CODES.has(c))) return "invite-only";
  if (codes.some((c) => RETRY_CODES.has(c))) return "retry";
  return "retry";
}

export function messageForAuthError(kind: AuthErrorKind): string {
  switch (kind) {
    case "invite-only":
      return INVITE_ONLY_MESSAGE;
    case "allowlist":
      return ALLOWLIST_MESSAGE;
    case "captcha":
      return CAPTCHA_MESSAGE;
    case "invalid-code":
      return INVALID_CODE_MESSAGE;
    case "offline":
      return OFFLINE_MESSAGE;
    default:
      return RETRY_MESSAGE;
  }
}
