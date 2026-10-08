export const LINKS_UNSUPPORTED_MESSAGE = "Links aren't supported yet.";
export const LINKS_UNSUPPORTED_ERROR = "links-not-supported";

export function isLinksUnsupportedRequest(params: { error?: string; url?: string }): boolean {
  return params.error === LINKS_UNSUPPORTED_ERROR || Boolean(params.url?.trim());
}
