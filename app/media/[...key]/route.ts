import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { r2 } from "@/lib/r2";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return new NextResponse(null, { status: 401 });
  }

  const { key } = await params;
  const objectKey = key.join("/");
  if (!objectKey.startsWith("items/") || objectKey.includes("..")) {
    return new NextResponse(null, { status: 404 });
  }

  const known = await db.execute(sql`
    select m.mime as mime
    from media_assets m
    where m.original_key = ${objectKey}
       or exists (select 1 from jsonb_each_text(m.variants) v where v.value = ${objectKey})
       or m.placeholder is not null and ${objectKey} like 'items/%'
    limit 1
  `);
  const mime = (known.rows[0] as { mime?: string } | undefined)?.mime;

  try {
    const result = await r2().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: objectKey }),
    );
    const body = result.Body!.transformToWebStream();
    return new NextResponse(body as unknown as ReadableStream, {
      headers: {
        "Content-Type": result.ContentType ?? mime ?? "application/octet-stream",
        "Content-Length": String(result.ContentLength ?? ""),
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
