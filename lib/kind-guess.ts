const OEMBED_PROVIDERS: Array<{ test: RegExp; endpoint: (url: string) => string }> = [
  {
    test: /^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/|embed\/)|youtu\.be\/)/i,
    endpoint: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
  {
    test: /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
    endpoint: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  },
];

export function matchOembedProvider(url: string): ((url: string) => string) | null {
  const hit = OEMBED_PROVIDERS.find((p) => p.test.test(url));
  return hit?.endpoint ?? null;
}

export function extractOgType(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
  if (m) return m[1];
  const m2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:type["']/i);
  return m2 ? m2[1] : null;
}

export function bodyTextLength(html: string): number {
  const withoutScripts = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return withoutScripts.trim().length;
}

export interface KindSignals {
  url: string;
  ogType: string | null;
  textLength: number;
}

export function guessLinkedKind(signals: KindSignals): "video" | "article" | "url" {
  if (matchOembedProvider(signals.url)) return "video";
  if (signals.ogType?.toLowerCase() === "article" || signals.textLength >= 800) return "article";
  return "url";
}
