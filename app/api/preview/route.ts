import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { fetchPage } from "@/lib/fetch-url";
import { extractOgType, bodyTextLength, guessLinkedKind } from "@/lib/kind-guess";
import { isHttpUrl } from "@/lib/url";
import { relevantFacetsFor } from "@/lib/relevance";
import type { ItemKind } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function ogContent(html: string, property: string): string | null {
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
  if (!m) return null;
  return m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const rawUrl = (body?.url ?? "").trim();
  if (!isHttpUrl(rawUrl)) {
    return NextResponse.json({ error: "bad-url" }, { status: 400 });
  }

  let kind: ItemKind = "url";
  let title: string | null = null;
  let description: string | null = null;
  let image: string | null = null;
  let host = safeHost(rawUrl);

  try {
    const page = await fetchPage(rawUrl);
    // Quick OG-tag parse for the capture preview; the authoritative metascraper
    // extraction runs in createLinkedItem at Save.
    title = ogContent(page.html, "og:title");
    description = ogContent(page.html, "og:description");
    image = ogContent(page.html, "og:image");
    kind = guessLinkedKind({
      url: rawUrl,
      ogType: extractOgType(page.html),
      textLength: bodyTextLength(page.html),
    });
    host = safeHost(page.finalUrl);
  } catch {
    // unfetchable preview still returns a valid response (metadata-only capture)
  }

  return NextResponse.json({
    ok: true,
    kind,
    title,
    description,
    image,
    host,
    relevant: relevantFacetsFor(kind),
  });
}
