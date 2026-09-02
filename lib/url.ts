const TRACKING_PARAMS = /^(utm_[a-z_]+|fbclid|gclid|msclkid|mc_eid|igshid)$/i;

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  const kept = [...url.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  url.search = "";
  for (const [k, v] of kept) url.searchParams.append(k, v);

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }

  let out = url.toString();
  out = out.replace(/\?$/, "");
  if (url.pathname === "/" && kept.length === 0) {
    out = out.replace(/\/$/, "");
  }
  return out;
}

export function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
