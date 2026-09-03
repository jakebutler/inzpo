import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { fetchPage } from "@/lib/fetch-url";
import { extractOgType, bodyTextLength, guessLinkedKind, matchOembedProvider } from "@/lib/kind-guess";
import { normalizeUrl, isHttpUrl } from "@/lib/url";
import { relevantFacetsFor } from "@/lib/relevance";
import type { ItemKind } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

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
    try {
      const [{ default: metascraper }, titleBundle, descriptionBundle, imageBundle] = await Promise.all([
        import("metascraper"),
        import("metascraper-title"),
        import("metascraper-description"),
        import("metascraper-image"),
      ]);
      const scrape = metascraper([
        // @ts-expect-error
        titleBundle.default(),
        // @ts-expect-error
        descriptionBundle.default(),
        // @ts-expect-error
        imageBundle.default(),
      ]);
      const meta = await scrape({ url: page.finalUrl, html: page.html });
      title = meta.title || null;
      description = meta.description || null;
      image = meta.image || null;
    } catch {
      // metadata best-effort
    }
    kind = guessLinkedKind({
      url: rawUrl,
      ogType: extractOgType(page.html),
      textLength: bodyTextLength(page.html),
    });
    host = safeHost(page.finalUrl);
    host = safeHost(page.finalUrl);
  } catch {
    return NextResponse.json({ ok: true, kind, title: null, description: null, image: null, host, relevant: relevantFacetsFor(kind) });
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

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
