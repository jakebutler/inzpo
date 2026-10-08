import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOwnerId, assertItemOwned } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { r2, tileKey, textureMetaKey } from "@/lib/r2";
import { makeSeamlessTile, nudgeCrop, type TextureCrop } from "@/lib/texture";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const row = (await db.select().from(mediaAssets).where(eq(mediaAssets.itemId, id)).limit(1))[0];
  if (!row) return NextResponse.json({ ok: false, error: "No photo" }, { status: 404 });
  const client = r2();
  const metaObj = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: textureMetaKey(id) }));
  const meta = JSON.parse(await metaObj.Body!.transformToString()) as TextureCrop & { step?: number };
  const next = nudgeCrop(meta, (meta.step ?? 0) + 1);
  const original = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: row.originalKey }));
  const buffer = Buffer.from(await original.Body!.transformToByteArray());
  const tile = await makeSeamlessTile(buffer, next);
  const key = tileKey(id);
  await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: tile, ContentType: "image/png" }));
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: textureMetaKey(id),
      Body: JSON.stringify({ ...next, step: (meta.step ?? 0) + 1 }),
      ContentType: "application/json",
    }),
  );
  await db
    .update(mediaAssets)
    .set({ variants: { ...row.variants, tile: key } })
    .where(eq(mediaAssets.id, row.id));
  revalidatePath(`/items/${id}`);
  return NextResponse.json({ ok: true });
}
