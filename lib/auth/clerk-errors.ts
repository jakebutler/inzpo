export const INVITE_ONLY_MESSAGE = "Inzpo is invite-only. Check with Jake.";
export const INVALID_CODE_MESSAGE = "That code didn't match. Try again.";
export const OFFLINE_MESSAGE = "You're offline. Connect and try again.";

export type AuthErrorKind = "invite-only" | "invalid-code" | "offline" | "unknown";

const INVALID_CODE_CODES = new Set([
  "form_code_incorrect",
  "verification_failed",
  "form_param_code_invalid",
]);

const INVITE_ONLY_CODES = new Set([
  "form_identifier_not_found",
  "sign_up_restricted",
  "not_allowed_access",
  "invitation_not_found",
  "authorization_invalid",
  "user_locked",
  "identifier_already_signed_in",
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
  if (typeof rec.message === "string" && /restricted|invite|not allowed|not found/i.test(rec.message)) {
    codes.push("sign_up_restricted");
  }
  return codes;
}

export function classifyAuthError(input: unknown): AuthErrorKind {
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return "offline";
  const codes = collectCodes(input);
  if (codes.some((c) => INVALID_CODE_CODES.has(c))) return "invalid-code";
  if (codes.some((c) => INVITE_ONLY_CODES.has(c))) return "invite-only";
  return "unknown";
}

export function messageForAuthError(kind: AuthErrorKind): string {
  switch (kind) {
    case "invite-only":
      return INVITE_ONLY_MESSAGE;
    case "invalid-code":
      return INVALID_CODE_MESSAGE;
    case "offline":
      return OFFLINE_MESSAGE;
    default:
      return INVITE_ONLY_MESSAGE;
  }
}
