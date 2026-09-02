import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml, extractReadableArticle } from "@/lib/article";

describe("sanitizeArticleHtml", () => {
  it("keeps text-level structure", () => {
    const out = sanitizeArticleHtml("<h2>Title</h2><p>Para <strong>bold</strong> and <a href=\"https://x.com\">link</a>.</p><ul><li>item</li></ul>");
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<p>Para <strong>bold</strong>");
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain("rel=\"noopener nofollow\"");
    expect(out).toContain("<li>item</li>");
  });

  it("drops images, scripts, iframes, styles", () => {
    const out = sanitizeArticleHtml('<div><img src="x.png"><script>alert(1)</script><style>.a{}</style><iframe src="https://x"></iframe><p>keep</p></div>');
    expect(out).not.toMatch(/<img|<script|<style|<iframe/i);
    expect(out).toContain("keep");
  });

  it("sanitizes nodes reintroduced by unwrapping", () => {
    const out = sanitizeArticleHtml('<div><picture><source srcset="x"><img src="y"></picture><p>safe</p></div>');
    expect(out).not.toMatch(/<img|<source/i);
    expect(out).toContain("safe");
  });

  it("strips event handlers and only keeps http(s) links", () => {
    const out = sanitizeArticleHtml('<p onclick="evil()">t</p><a href="javascript:alert(1)">bad</a><a href="https://ok.com">good</a>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("https://ok.com");
  });

  it("survives XSS payload classics", () => {
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<div><style>@import url(x)</style></div>',
    ];
    for (const p of payloads) {
      const out = sanitizeArticleHtml(`<p>before</p>${p}<p>after</p>`);
      expect(out).not.toMatch(/<script|<svg|<iframe|<img|onerror|javascript:/i);
      expect(out).toContain("before");
      expect(out).toContain("after");
    }
    // unclosed containers swallow trailing markup at the parser level; only assert neutralization
    for (const p of ['<iframe src="javascript:alert(1)">', '<svg onload=alert(1)>', "<<script>alert(1)</script>>"]) {
      const out = sanitizeArticleHtml(`<p>before</p>${p}<p>after</p>`);
      expect(out).not.toMatch(/<script|<svg|<iframe|<img|onerror|javascript:|alert\(/i);
      expect(out).toContain("before");
    }
  });
});

describe("extractReadableArticle", () => {
  it("extracts readable content from simple HTML", () => {
    const html = `<html><head><title>T</title></head><body><article><h1>Head</h1>${"<p>Paragraph of real content here. </p>".repeat(20)}</article></body></html>`;
    const result = extractReadableArticle(html, "https://example.com/post");
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Paragraph of real content");
  });

  it("returns null for empty pages", () => {
    expect(extractReadableArticle("<html><body></body></html>", "https://example.com")).toBeNull();
    expect(extractReadableArticle("not html at all", "https://example.com")).toBeNull();
  });
});
