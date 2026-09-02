if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, getWallItems, deleteItem } = await import("../lib/items");
const { db } = await import("../lib/db");
const itemsMod = await import("../lib/db/schema");
const items = itemsMod.items;
const { eq } = await import("drizzle-orm");
const { r2, GetObjectCommand } = await import("../lib/r2");

const input = await sharp({
  create: { width: 1800, height: 900, channels: 3, background: { r: 20, g: 80, b: 160 } },
})
  .png()
  .toBuffer();

const id = await createImageItem({ buffer: input, filename: "e2e smoke photo.png" });
console.log("created item", id);

const wall = await getWallItems();
const item = wall.find((w) => w.id === id);
if (!item || !item.displayKey) throw new Error("item missing from wall or has no display variant");
console.log("wall item:", item.kind, "| title:", item.title, "| display:", item.displayKey, "| aspect:", item.aspect);

const obj = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: item.displayKey }));
const meta = await sharp(Buffer.from(await obj.Body!.transformToByteArray())).metadata();
console.log("variant fetchable from R2:", meta.format, meta.width + "x" + meta.height);
if (meta.format !== "webp" || meta.width !== 640) throw new Error("w640 variant wrong");

await deleteItem(id);
const after = await getWallItems();
if (after.find((w) => w.id === id)) throw new Error("delete did not remove item");
const leftovers = await db.select().from(items).where(eq(items.id, id));
if (leftovers.length > 0) throw new Error("row still present");
console.log("delete cascade OK — e2e photo path passes");
