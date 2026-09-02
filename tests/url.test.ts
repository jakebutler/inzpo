import { describe, expect, it } from "vitest";
import { normalizeUrl, isHttpUrl } from "@/lib/url";
import { matchOembedProvider, guessLinkedKind, extractOgType, bodyTextLength } from "@/lib/kind-guess";

describe("normalizeUrl (Duplicate notice comparison)", () => {
  const cases: Array<[string, string]> = [
    ["https://example.com/page", "https://example.com/page"],
    ["https://example.com/page/", "https://example.com/page"],
    ["https://example.com/page/", "https://example.com/page"],
    ["HTTPS://EXAMPLE.COM/Page", "https://example.com/Page"],
    ["https://example.com/page#section", "https://example.com/page"],
    ["https://example.com/page?utm_source=x&utm_medium=y&id=7", "https://example.com/page?id=7"],
    ["https://example.com/page?fbclid=abc", "https://example.com/page"],
    ["https://example.com/page?gclid=abc&q=1", "https://example.com/page?q=1"],
    ["http://example.com", "http://example.com"],
    ["https://example.com", "https://example.com"],
    ["https://example.com/a/b/", "https://example.com/a/b"],
  ];

  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      expect(normalizeUrl(input)).toBe(expected);
    });
  }

  it("differently dressed links to the same page compare equal", () => {
    const a = normalizeUrl("HTTPS://Example.com/Post/?utm_campaign=launch#top");
    const b = normalizeUrl("https://example.com/Post");
    expect(a).toBe(b);
  });
});

describe("isHttpUrl", () => {
  it("accepts http(s) only", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("kind auto-guess", () => {
  it("detects oEmbed providers", () => {
    expect(matchOembedProvider("https://www.youtube.com/watch?v=abc")).not.toBeNull();
    expect(matchOembedProvider("https://youtu.be/abc")).not.toBeNull();
    expect(matchOembedProvider("https://vimeo.com/12345678")).not.toBeNull();
    expect(matchOembedProvider("https://example.com/video")).toBeNull();
  });

  it("guesses kind from signals", () => {
    expect(guessLinkedKind({ url: "https://youtu.be/x", ogType: null, textLength: 0 })).toBe("video");
    expect(guessLinkedKind({ url: "https://example.com/post", ogType: "article", textLength: 10 })).toBe("article");
    expect(guessLinkedKind({ url: "https://example.com/post", ogType: null, textLength: 5000 })).toBe("article");
    expect(guessLinkedKind({ url: "https://example.com", ogType: "website", textLength: 50 })).toBe("url");
    expect(guessLinkedKind({ url: "https://example.com", ogType: null, textLength: 799 })).toBe("url");
  });

  it("extracts og:type and body text length", () => {
    const html = `<html><head><meta property="og:type" content="article"></head><body>${"<p>word </p>".repeat(200)}</body></html>`;
    expect(extractOgType(html)).toBe("article");
    expect(bodyTextLength(html)).toBeGreaterThan(800);
    expect(extractOgType("<html></html>")).toBeNull();
  });
});
