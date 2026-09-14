import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { selectExpiredTmp, TMP_PREFIX } from "@/lib/reaper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured; reaper is disabled" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = r2();
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "R2_BUCKET is not configured" }, { status: 503 });
  }

  const now = new Date();
  const expired: string[] = [];
  let scanned = 0;
  let cursor: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: TMP_PREFIX, ContinuationToken: cursor }),
    );
    const contents = page.Contents ?? [];
    scanned += contents.filter((obj) => obj.Key).length;
    const objects = contents
      .filter((obj): obj is typeof obj & { Key: string } => !!obj.Key)
      .map((obj) => ({ key: obj.Key, lastModified: obj.LastModified }));
    expired.push(...selectExpiredTmp(objects, now));
    cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (cursor);

  let deleted = 0;
  for (let i = 0; i < expired.length; i += 1000) {
    const batch = expired.slice(i, i + 1000).map((Key) => ({ Key }));
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch } }));
    deleted += batch.length;
  }

  return NextResponse.json({ scanned, expired: expired.length, deleted });
}
