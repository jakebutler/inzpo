const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Inzpo/1.0 (+https://github.com/jakebutler/inzpo)";
const MAX_REDIRECTS = 5;

import { assertPublicHost } from "@/lib/ssrf";

export interface FetchedPage {
  finalUrl: string;
  html: string;
}

async function fetchCapped(url: string, accept: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Blocked non-http URL");
    await assertPublicHost(parsed.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": UA, Accept: accept },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect without location (${res.status})`);
      current = new URL(location, current).toString();
      await res.body?.cancel();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function readCapped(res: Response): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Response exceeded byte cap");
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const res = await fetchCapped(url, "text/html,application/xhtml+xml");
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const html = await readCapped(res);
  return { finalUrl: res.url || url, html: html.toString("utf8") };
}

export async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetchCapped(url, "image/*,application/json;q=0.9,*/*;q=0.8");
  if (!res.ok) throw new Error(`Preview fetch failed: HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/") && !type.includes("json")) {
    throw new Error(`Preview is not an image: ${type}`);
  }
  return readCapped(res);
}

export async function fetchOembedJson(endpoint: string): Promise<Record<string, unknown>> {
  const res = await fetchCapped(endpoint, "application/json");
  if (!res.ok) throw new Error(`oEmbed failed: HTTP ${res.status}`);
  const buf = await readCapped(res);
  return JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
}
