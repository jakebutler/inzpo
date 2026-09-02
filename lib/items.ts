import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, mediaAssets, type ItemKind } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { itemPrefix, originalKey, PutObjectCommand, deletePrefix, r2 } from "@/lib/r2";
import { processImage, looksLikeScreenshot, deriveTitleFromFilename } from "@/lib/media";

export interface WallItem {
  id: string;
  kind: ItemKind;
  title: string | null;
  note: string | null;
  createdAt: Date;
  displayKey: string | null;
  thumbKey: string | null;
  placeholder: string | null;
  aspect: number | null;
  hexColors: string[];
}

export async function getWallItems(): Promise<WallItem[]> {
  const rows = await db
    .select({
      id: items.id,
      kind: items.kind,
      title: items.title,
      note: items.note,
      createdAt: items.createdAt,
      displayKey: sql<string | null>`(select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = items.id and v.key = 'w640' limit 1)`,
      thumbKey: sql<string | null>`(select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = items.id and v.key = 'w256' limit 1)`,
      placeholder: sql<string | null>`(select m.placeholder from media_assets m where m.item_id = items.id and m.role = 'primary' limit 1)`,
      aspect: sql<number | null>`(select round(m.width::numeric / nullif(m.height, 0), 4)::float8 from media_assets m where m.item_id = items.id and m.role = 'primary' limit 1)`,
      hexColors: sql<string[]>`coalesce((select array_agg(c.hex order by c.position) from item_colors c where c.item_id = items.id), '{}')`,
    })
    .from(items)
    .where(eq(items.captureState, "ready"))
    .orderBy(desc(items.createdAt));
  return rows;
}

export interface ItemDetail {
  id: string;
  kind: ItemKind;
  title: string | null;
  note: string | null;
  createdAt: Date;
  source: { url: string; title: string | null; description: string | null } | null;
  media: { originalKey: string; displayKey: string | null; placeholder: string | null; mime: string; width: number; height: number } | null;
  colors: Array<{ hex: string; family: string; origin: string; position: number }>;
  origin: { derivedItemId: string; originItemId: string } | null;
}

export async function getItemDetail(id: string): Promise<ItemDetail | null> {
  const rows = await db
    .select({
      id: items.id,
      kind: items.kind,
      title: items.title,
      note: items.note,
      createdAt: items.createdAt,
      url: sql<string | null>`(select s.url from item_sources s where s.item_id = items.id)`,
      sourceTitle: sql<string | null>`(select s.title from item_sources s where s.item_id = items.id)`,
      sourceDescription: sql<string | null>`(select s.description from item_sources s where s.item_id = items.id)`,
      originalKey: sql<string | null>`(select m.original_key from media_assets m where m.item_id = items.id limit 1)`,
      displayKey: sql<string | null>`(select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = items.id and v.key = 'w1600' limit 1)`,
      placeholder: sql<string | null>`(select m.placeholder from media_assets m where m.item_id = items.id limit 1)`,
      mime: sql<string | null>`(select m.mime from media_assets m where m.item_id = items.id limit 1)`,
      width: sql<number | null>`(select m.width from media_assets m where m.item_id = items.id limit 1)`,
      height: sql<number | null>`(select m.height from media_assets m where m.item_id = items.id limit 1)`,
    })
    .from(items)
    .where(and(eq(items.id, id), eq(items.captureState, "ready")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    note: row.note,
    createdAt: row.createdAt,
    source: row.url ? { url: row.url, title: row.sourceTitle, description: row.sourceDescription } : null,
    media:
      row.originalKey && row.mime && row.width && row.height
        ? {
            originalKey: row.originalKey,
            displayKey: row.displayKey,
            placeholder: row.placeholder,
            mime: row.mime,
            width: row.width,
            height: row.height,
          }
        : null,
    colors: [],
    origin: null,
  };
}

export async function deleteItem(id: string): Promise<void> {
  await deletePrefix(itemPrefix(id));
  await db.delete(items).where(eq(items.id, id));
}

export async function createImageItem(input: {
  buffer: Buffer;
  filename?: string | null;
}): Promise<string> {
  const kind: ItemKind = looksLikeScreenshot(input.filename) ? "screenshot" : "photo";
  const id = newId();
  await db.insert(items).values({
    id,
    kind,
    title: deriveTitleFromFilename(input.filename),
    captureState: "preparing",
  });
  try {
    const processed = await processImage(input.buffer, id);
    const client = r2();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: originalKey(id, processed.ext),
        Body: processed.original,
        ContentType: processed.mime,
      }),
    );
    const variantMap: Record<string, string> = {};
    for (const [name, variant] of Object.entries(processed.variants)) {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: variant.key,
          Body: variant.buffer,
          ContentType: "image/webp",
        }),
      );
      variantMap[name] = variant.key;
    }
    await db.insert(mediaAssets).values({
      id: newId(),
      itemId: id,
      role: "primary",
      originalKey: originalKey(id, processed.ext),
      originalSha256: processed.sha256,
      originalBytes: processed.bytes,
      mime: processed.mime,
      width: processed.width,
      height: processed.height,
      variants: variantMap,
      placeholder: processed.placeholder,
    });
    await db.update(items).set({ captureState: "ready" }).where(eq(items.id, id));
    return id;
  } catch (err) {
    await deletePrefix(itemPrefix(id)).catch(() => {});
    await db.delete(items).where(eq(items.id, id));
    throw err;
  }
}
