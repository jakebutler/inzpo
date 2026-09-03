import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { createImageItem } from "@/lib/items";
import { createLinkedItem } from "@/lib/capture-url";
import { newId } from "@/lib/ids";
import { r2, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@/lib/r2";

export const dynamic = "force-dynamic";

async function authed(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return !!token && (await verifySessionToken(token));
}

function firstHttpUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(/https?:\/\/[^\s<>"']+/i);
    if (m) return m[0];
  }
  return null;
}

async function saveStashedImage(bytes: Buffer, mime: string): Promise<string> {
  const token = newId();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  await r2().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: `tmp/${token}.${ext}`, Body: bytes, ContentType: mime }),
  );
  return `tmp/${token}.${ext}`;
}

export async function POST(request: NextRequest) {
  if (!(await authed(request))) {
    // Stash files so a cold-start share survives the login round-trip; links ride the query string.
    const contentType = request.headers.get("content-type") ?? "";
    let url = request.nextUrl.searchParams.get("url");
    let text = request.nextUrl.searchParams.get("text");
    let stashedKey: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      const file = fd.get("image");
      if (file instanceof File && file.size > 0 && file.type.startsWith("image/") && file.size <= 25 * 1024 * 1024) {
        stashedKey = await saveStashedImage(Buffer.from(await file.arrayBuffer()), file.type);
      }
      url = url ?? (fd.get("url") as string | null);
      text = text ?? (fd.get("text") as string | null);
    }

    const target = stashedKey
      ? `/capture?shareToken=${encodeURIComponent(stashedKey)}`
      : `/capture?url=${encodeURIComponent(url ?? firstHttpUrl(text ?? "") ?? "")}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(target)}`, request.url), 303);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let url = request.nextUrl.searchParams.get("url");
  let text = request.nextUrl.searchParams.get("text");
  let file: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData();
    const f = fd.get("image");
    if (f instanceof File && f.size > 0) file = f;
    url = url ?? (fd.get("url") as string | null);
    text = text ?? (fd.get("text") as string | null);
  }

  // image share → Photo item (first image only)
  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const itemId = await createImageItem({ buffer, filename: file.name || "shared-image" });
    return NextResponse.redirect(new URL(`/capture?saved=${itemId}`, request.url), 303);
  }

  // link share: url param, else scan the text
  const link = url ?? firstHttpUrl(text ?? "");
  if (link) {
    const result = await createLinkedItem({ rawUrl: link });
    return NextResponse.redirect(new URL(`/capture?saved=${result.itemId}`, request.url), 303);
  }

  return NextResponse.redirect(new URL("/capture", request.url), 303);
}
