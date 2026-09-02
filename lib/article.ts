import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li", "blockquote",
  "em", "strong", "b", "i", "code", "pre", "br", "hr",
  "table", "thead", "tbody", "tr", "td", "th",
  "a", "figure", "figcaption", "article", "section", "div", "span", "aside",
]);

const DROP_TAGS = new Set(["script", "style", "noscript", "iframe", "img", "svg", "video", "audio", "form", "input", "button", "link", "meta", "source", "track", "embed", "object"]);

export function sanitizeArticleHtml(html: string): string {
  const { document } = parseHTML(`<body>${html}</body>`);
  const body = document.querySelector("body");
  if (!body) return "";

  function walk(node: Element) {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase();
      if (DROP_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      // sanitize the subtree first so unwrapping never reintroduces dirty nodes
      walk(child);
      if (tag === "a") {
        const href = child.getAttribute("href") ?? "";
        for (const attr of [...child.attributes]) {
          child.removeAttribute(attr.name);
        }
        if (/^https?:\/\//i.test(href)) {
          child.setAttribute("href", href);
          child.setAttribute("rel", "noopener nofollow");
          child.setAttribute("target", "_blank");
        }
      } else {
        for (const attr of [...child.attributes]) {
          child.removeAttribute(attr.name);
        }
      }
      if (!ALLOWED_TAGS.has(tag)) {
        const parent = child.parentNode;
        if (parent) {
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
        }
        child.remove();
      }
    }
  }
  walk(body);
  return body.innerHTML;
}

export interface ExtractedArticle {
  title: string | null;
  html: string;
}

export function extractReadableArticle(sourceHtml: string, _sourceUrl: string): ExtractedArticle | null {
  try {
    const { document } = parseHTML(sourceHtml);
    const reader = new Readability(document as unknown as Document, {});
    const parsed = reader.parse();
    if (!parsed || !parsed.content) return null;
    return {
      title: parsed.title ?? null,
      html: sanitizeArticleHtml(parsed.content),
    };
  } catch {
    return null;
  }
}
