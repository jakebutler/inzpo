import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemColors, items, mediaAssets, type ColorRole, type ItemKind } from "@/lib/db/schema";
import { assertItemOwned, ownerClause } from "@/lib/auth/owner";
import { newId } from "@/lib/ids";
import { itemPrefix, originalKey, PutObjectCommand, GetObjectCommand, deletePrefix, r2 } from "@/lib/r2";
import { processImage, looksLikeScreenshot, deriveTitleFromFilename } from "@/lib/media";
import { extractPalette } from "@/lib/palette-extract";
import { buildWallQuery } from "@/lib/wall-query";
import type { FilterState } from "@/lib/filter";

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
  facetTags: Array<{ facet: string; value: string }>;
  freeTags: string[];
  sourceUrl: string | null;
}

export async function getWallItems(ownerId: string, state: FilterState, collectionId?: string | null): Promise<WallItem[]> {
  const { where, orderBy } = buildWallQuery(state, collectionId, ownerId);
  const rows = await db.execute(sql`
    select i.id,
      i.kind,
      i.title,
      i.note,
      i.created_at as "createdAt",
      (select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = i.id and v.key = 'w640' limit 1) as "displayKey",
      (select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = i.id and v.key = 'w256' limit 1) as "thumbKey",
      (select m.placeholder from media_assets m where m.item_id = i.id and m.role = 'primary' limit 1) as "placeholder",
      (select round(m.width::numeric / nullif(m.height, 0), 4)::float8 from media_assets m where m.item_id = i.id and m.role = 'primary' limit 1) as "aspect",
      coalesce((select array_agg(c.hex order by c.position) from item_colors c where c.item_id = i.id), '{}') as "hexColors",
      coalesce((select jsonb_agg(jsonb_build_object('facet', f.name, 'value', fv.value) order by f.position, fv.value) from item_facet_values ifv join facet_values fv on fv.id = ifv.facet_value_id join facets f on f.id = fv.facet_id where ifv.item_id = i.id), '[]'::jsonb) as "facetTags",
      coalesce((select jsonb_agg(ft.name order by ft.name) from item_free_tags ift join free_tags ft on ft.id = ift.free_tag_id where ift.item_id = i.id), '[]'::jsonb) as "freeTags",
      (select s.url from item_sources s where s.item_id = i.id) as "sourceUrl"
    from items i
    where ${where}
    order by ${orderBy}
  `);
  return rows.rows as unknown as WallItem[];
}

export async function countWallItems(ownerId: string, state: FilterState, collectionId?: string | null): Promise<number> {
  const { where } = buildWallQuery(state, collectionId, ownerId);
  const rows = await db.execute(sql`select count(*)::int as n from items i where ${where}`);
  return (rows.rows[0] as { n: number }).n;
}

export interface ItemDetail {
  id: string;
  kind: ItemKind;
  title: string | null;
  note: string | null;
  createdAt: Date;
  source: { url: string; title: string | null; description: string | null } | null;
  oembedHtml: string | null;
  hasArticle: boolean;
  media: { originalKey: string; displayKey: string | null; placeholder: string | null; mime: string; width: number; height: number } | null;
  colors: Array<{
    hex: string;
    family: string;
    origin: string;
    position: number;
    name: string | null;
    role: ColorRole | null;
    pinX: number | null;
    pinY: number | null;
  }>;
  origin: { derivedItemId: string; originItemId: string } | null;
}

export async function getItemDetail(ownerId: string, id: string): Promise<ItemDetail | null> {
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
      oembedHtml: sql<string | null>`(select s.oembed_html from item_sources s where s.item_id = items.id)`,
      articleKey: sql<string | null>`(select s.article_key from item_sources s where s.item_id = items.id)`,
      originalKey: sql<string | null>`(select m.original_key from media_assets m where m.item_id = items.id limit 1)`,
      displayKey: sql<string | null>`(select v.value from media_assets m, jsonb_each_text(m.variants) v where m.item_id = items.id and v.key = 'w1600' limit 1)`,
      placeholder: sql<string | null>`(select m.placeholder from media_assets m where m.item_id = items.id limit 1)`,
      mime: sql<string | null>`(select m.mime from media_assets m where m.item_id = items.id limit 1)`,
      width: sql<number | null>`(select m.width from media_assets m where m.item_id = items.id limit 1)`,
      height: sql<number | null>`(select m.height from media_assets m where m.item_id = items.id limit 1)`,
    })
    .from(items)
    .where(and(eq(items.id, id), eq(items.captureState, "ready"), ownerClause(items.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const tagRows = await db.execute(sql`
    select hex, family, origin, position, name, role, pin_x as "pinX", pin_y as "pinY"
    from item_colors where item_id = ${id} order by position
  `);
  const colors = (
    tagRows.rows as Array<{
      hex: string;
      family: string;
      origin: string;
      position: number;
      name: string | null;
      role: ColorRole | null;
      pinX: number | null;
      pinY: number | null;
    }>
  ).map((c) => ({
    hex: c.hex,
    family: c.family,
    origin: c.origin,
    position: c.position,
    name: c.name,
    role: c.role,
    pinX: c.pinX,
    pinY: c.pinY,
  }));
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    note: row.note,
    createdAt: row.createdAt,
    source: row.url ? { url: row.url, title: row.sourceTitle, description: row.sourceDescription } : null,
    oembedHtml: row.oembedHtml ?? null,
    hasArticle: !!row.articleKey,
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
    colors,
    origin: null,
  };
}

export async function deleteItem(ownerId: string, id: string): Promise<void> {
  await assertItemOwned(ownerId, id);
  await deletePrefix(itemPrefix(id));
  await db.delete(items).where(and(eq(items.id, id), ownerClause(items.ownerId, ownerId)));
}

export async function createImageItem(input: {
  ownerId: string;
  buffer: Buffer;
  filename?: string | null;
}): Promise<string> {
  const kind: ItemKind = looksLikeScreenshot(input.filename) ? "screenshot" : "photo";
  const id = newId();
  await db.insert(items).values({
    id,
    ownerId: input.ownerId,
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

    const palette = await extractPalette(processed.original);
    if (palette.swatches.length > 0) {
      await db.insert(itemColors).values(
        palette.swatches.map((c, index) => ({
          id: newId(),
          itemId: id,
          hex: c.hex,
          family: c.family,
          origin: "extracted",
          position: index,
          name: c.name,
          role: c.role,
          pinX: c.pinX,
          pinY: c.pinY,
        })),
      );
    }

    await db.update(items).set({ captureState: "ready" }).where(eq(items.id, id));
    return id;
  } catch (err) {
    await deletePrefix(itemPrefix(id)).catch(() => {});
    await db.delete(items).where(eq(items.id, id));
    throw err;
  }
}

export async function getArticleHtml(ownerId: string, itemId: string): Promise<string | null> {
  await assertItemOwned(ownerId, itemId);
  const rows = await db.execute(sql`select article_key from item_sources where item_id = ${itemId} and article_key is not null limit 1`);
  const key = (rows.rows[0] as { article_key?: string } | undefined)?.article_key;
  if (!key) return null;
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    const body = result.Body as unknown as { transformToString: (enc: string) => Promise<string> };
    return (await body.transformToString("utf8")) || null;
  } catch {
    return null;
  }
}
