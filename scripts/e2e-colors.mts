if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, getWallItems, getItemDetail, deleteItem } = await import("../lib/items");

const input = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 100, b: 200 } } })
  .png()
  .toBuffer();
const itemId = await createImageItem({ buffer: input, filename: "blue smoke.png" });

const detail = await getItemDetail(itemId);
console.log("colors:", detail?.colors.map((c) => `${c.hex}→${c.family} (${c.origin})`).join(", "));
if (!detail || detail.colors.length < 1) throw new Error("no colors extracted");
const families = new Set(detail.colors.map((c) => c.family));
console.log("families:", [...families].join(", "));

const wall = await getWallItems();
const card = wall.find((w) => w.id === itemId)!;
if (card.hexColors.length === 0) throw new Error("wall has no hex colors");
console.log("wall swatches:", card.hexColors.join(", "));

await deleteItem(itemId);
console.log("color extraction e2e passes");
