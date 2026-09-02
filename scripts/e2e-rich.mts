if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { getItemDetail, getArticleHtml, deleteItem, createImageItem } = await import("../lib/items");
const { createLinkedItem } = await import("../lib/capture-url");
const { createPaletteFromItem, getOrigin, getDerivedItems } = await import("../lib/palettes");
const { db } = await import("../lib/db");
const { itemSources } = await import("../lib/db/schema");
const { eq } = await import("drizzle-orm");

// --- Article: Archived copy
const article = await createLinkedItem({ rawUrl: "https://www.joshwcomeau.com/animation/css-transitions/" });
const articleHtml = await getArticleHtml(article.itemId);
const hasStructure = articleHtml ? /<(p|h2|h3|ul|ol)/i.test(articleHtml) : false;
console.log(`article: kind=${article.kind} archived=${articleHtml ? "yes (" + articleHtml.length + " bytes)" : "NO"} structured=${hasStructure ? "✓" : "✗"}`);
if (articleHtml) {
  if (/<(script|iframe|img)/i.test(articleHtml)) throw new Error("sanitizer leaked forbidden tags");
  if (/onerror=/i.test(articleHtml)) throw new Error("sanitizer leaked event handlers");
}
const src = await db.select({ bytes: itemSources.articleBytes }).from(itemSources).where(eq(itemSources.itemId, article.itemId));
console.log("  db byte size recorded:", src[0]?.bytes ?? "MISSING");
if (article.kind !== "article") throw new Error("article kind wrong");

// --- Video: oEmbed short-circuit
const video = await createLinkedItem({ rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
const vd = await getItemDetail(video.itemId);
console.log(`video: kind=${video.kind} poster=${video.previewCaptured ? "captured ✓" : "NO"} embed=${vd?.oembedHtml ? "stored ✓" : "NO"}`);
if (!vd?.oembedHtml?.includes("iframe")) throw new Error("oembed html missing");
const embedSrc = vd.oembedHtml.match(/src=["']([^"']+)["']/i)?.[1];
if (!embedSrc) throw new Error("no embed src");
console.log("  embed src:", embedSrc.slice(0, 60) + "…");

// --- Palette from extracted colors + Origin
const img = await sharp({ create: { width: 500, height: 400, channels: 3, background: { r: 180, g: 60, b: 30 } } }).png().toBuffer();
const photoId = await createImageItem({ buffer: img, filename: "palette source.png" });
const paletteId = await createPaletteFromItem(photoId);
const paletteDetail = await getItemDetail(paletteId);
const origin = await getOrigin(paletteId);
const derived = await getDerivedItems(photoId);
console.log(`palette: kind=${paletteDetail?.kind} colors=${paletteDetail?.colors.length} origin=${origin === photoId ? "✓" : "WRONG"} derivedBack=${derived.some((d) => d.id === paletteId) ? "✓" : "✗"}`);
if (paletteDetail?.kind !== "palette" || (paletteDetail.colors.length ?? 0) < 1) throw new Error("palette substance wrong");

// delete the Origin item → link clears, palette survives
await deleteItem(photoId);
const originAfter = await getOrigin(paletteId);
const paletteAfter = await getItemDetail(paletteId);
console.log(`after deleting origin: origin link=${originAfter === null ? "cleared ✓" : "STILL THERE"} palette survives=${paletteAfter ? "✓" : "GONE"}`);
if (originAfter !== null || !paletteAfter) throw new Error("origin cascade wrong");

for (const id of [article.itemId, video.itemId, paletteId]) await deleteItem(id);
console.log("rich capture e2e passes");
