import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemSources, items, mediaAssets, type ItemKind } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { originalKey, PutObjectCommand, deletePrefix, r2 } from "@/lib/r2";
import { processImage } from "@/lib/media";
import { fetchImageBytes, fetchPage, type FetchedPage } from "@/lib/fetch-url";
import { extractOgType, bodyTextLength, guessLinkedKind } from "@/lib/kind-guess";
import { normalizeUrl } from "@/lib/url";
import type { TagSelection } from "@/lib/tags";
import { attachTags } from "@/lib/ontology";

type Scraper = (input: { url: string; html: string }) => Promise<Record<string, string>>;
let scraper: Scraper | null = null;

async function getScraper(): Promise<Scraper> {
  if (!scraper) {
    const [{ default: metascraper }, titleBundle, descriptionBundle, imageBundle, logoBundle, logoFaviconBundle, publisherBundle] =
      await Promise.all([
        import("metascraper"),
        import("metascraper-title"),
        import("metascraper-description"),
        import("metascraper-image"),
        import("metascraper-logo"),
        import("metascraper-logo-favicon"),
        import("metascraper-publisher"),
      ]);
    scraper = metascraper([
      titleBundle.default(),
      descriptionBundle.default(),
      imageBundle.default(),
      logoBundle.default(),
      logoFaviconBundle.default(),
      publisherBundle.default(),
    ]) as Scraper;
  }
  return scraper;
}

export interface CreateLinkedItemInput {
  rawUrl: string;
  tags?: TagSelection;
}

export interface CreateLinkedItemResult {
  itemId: string;
  kind: ItemKind;
  previewCaptured: boolean;
}

export async function createLinkedItem(input: CreateLinkedItemInput): Promise<CreateLinkedItemResult> {
  const normalized = normalizeUrl(input.rawUrl);
  const id = newId();

  let page: FetchedPage | null = null;
  let metadata: Record<string, string> = {};
  try {
    page = await fetchPage(input.rawUrl);
  } catch {
    page = null; // unfetchable-but-saved
  }

  let kind: ItemKind = "url";
  if (page) {
    try {
      metadata = await (await getScraper())({ url: page.finalUrl, html: page.html });
    } catch {
      metadata = {};
    }
    kind = guessLinkedKind({
      url: input.rawUrl,
      ogType: extractOgType(page.html),
      textLength: bodyTextLength(page.html),
    });
  }

  await db.insert(items).values({
    id,
    kind,
    title: metadata.title || null,
    captureState: "preparing",
  });

  await db.insert(itemSources).values({
    itemId: id,
    url: input.rawUrl.trim(),
    urlNormalized: normalized,
    title: metadata.title || null,
    description: metadata.description || null,
    previewProvenanceUrl: metadata.image || null,
  });

  let previewCaptured = false;
  try {
    if (page && metadata.image) {
      try {
        const bytes = await fetchImageBytes(metadata.image);
        const processed = await processImage(bytes, id);
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
          role: "preview",
          originalKey: originalKey(id, processed.ext),
          originalSha256: processed.sha256,
          originalBytes: processed.bytes,
          mime: processed.mime,
          width: processed.width,
          height: processed.height,
          variants: variantMap,
          placeholder: processed.placeholder,
        });
        previewCaptured = true;
      } catch {
        previewCaptured = false; // preview failure never fails the capture
      }
    }
    if (input.tags) await attachTags(id, input.tags);
    await db.update(items).set({ captureState: "ready" }).where(eq(items.id, id));
  } catch (err) {
    await deletePrefix(`items/${id}/`).catch(() => {});
    await db.delete(items).where(eq(items.id, id));
    throw err;
  }

  return { itemId: id, kind, previewCaptured };
}

export async function findExistingByNormalizedUrl(normalized: string): Promise<{ itemId: string; title: string | null } | null> {
  const rows = await db.execute(sql`
    select i.id, i.title
    from item_sources s join items i on i.id = s.item_id
    where s.url_normalized = ${normalized} and i.capture_state = 'ready'
    order by i.created_at asc
    limit 1
  `);
  const row = rows.rows[0] as { id: string; title: string | null } | undefined;
  return row ? { itemId: row.id, title: row.title } : null;
}
