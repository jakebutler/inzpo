const INVITE_ERROR = "That email isn't on the invite list yet.";
export const AUTH_RETRY_MESSAGE = "Couldn't sign in. Please try again.";

export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return AUTH_RETRY_MESSAGE;
  const details = error as { code?: unknown; message?: unknown; errors?: unknown[] };
  const codes = [details.code, details.message];
  for (const entry of details.errors ?? []) {
    if (entry && typeof entry === 'object') {
      const detail = entry as { code?: unknown; message?: unknown };
      codes.push(detail.code, detail.message);
    }
  }
  return codes.some((code) => typeof code === 'string' &&
    /identifier[_ ]not[_ ]found|restricted|not[_ ]allowed|not[_ ]invited/i.test(code))
    ? INVITE_ERROR : AUTH_RETRY_MESSAGE;
}
