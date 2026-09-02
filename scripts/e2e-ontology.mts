if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, getWallItems, deleteItem } = await import("../lib/items");
const { getFacetsWithValues, attachTags, getItemTags } = await import("../lib/ontology");

const facets = await getFacetsWithValues();
console.log("facets:", facets.map((f) => `${f.name}(${f.values.length})`).join(" "));

const style = facets.find((f) => f.name === "Style")!;
const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 20 } } }).png().toBuffer();
const itemId = await createImageItem({ buffer: input, filename: "tagged smoke.png" });

await attachTags(itemId, {
  facetValues: [
    { facetId: style.id, value: "minimal" },
    { facetId: style.id, value: "a brand new value" },
  ],
  freeTags: ["inspo"],
});

const tags = await getItemTags(itemId);
console.log("tags:", JSON.stringify(tags));
if (!tags.facetTags.some((t) => t.value === "minimal")) throw new Error("seeded value missing");
if (!tags.facetTags.some((t) => t.value === "a brand new value")) throw new Error("create-on-type missing");
if (!tags.freeTags.includes("inspo")) throw new Error("free tag missing");

const wall = await getWallItems();
const card = wall.find((w) => w.id === itemId)!;
if (card.facetTags.length !== 2 || card.freeTags.length !== 1) throw new Error("wall aggregation wrong");
console.log("wall card carries tags ✓");

await deleteItem(itemId);
const after = await getItemTags(itemId);
if (after.facetTags.length !== 0 || after.freeTags.length !== 0) throw new Error("tag cascade failed");
console.log("tag cascade on delete ✓ — ontology e2e passes");
