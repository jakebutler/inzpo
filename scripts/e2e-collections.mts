if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, deleteItem } = await import("../lib/items");
const { createLinkedItem, findExistingByNormalizedUrl } = await import("../lib/capture-url");
const { createCollection, addToCollection, listCollections, deleteCollection, renameCollection } = await import("../lib/collections");
const { getItemCollections } = await import("../lib/item-collections");
const { db } = await import("../lib/db");
const { collectionItems } = await import("../lib/db/schema");
const { eq, asc } = await import("drizzle-orm");
const { normalizeUrl } = await import("../lib/url");
const normalize = normalizeUrl;

function img() {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 90, g: 90, b: 90 } } }).png().toBuffer();
}

const i1 = await createImageItem({ buffer: await img(), filename: "one.png" });
const i2 = await createImageItem({ buffer: await img(), filename: "two.png" });
const i3 = await createImageItem({ buffer: await img(), filename: "three.png" });

const cid = await createCollection("E2E Collection");
await addToCollection(cid, i1);
await addToCollection(cid, i2);
let order = (await db.select().from(collectionItems).where(eq(collectionItems.collectionId, cid)).orderBy(asc(collectionItems.position))).map((r) => r.itemId);
console.log("order after 2 adds:", order.map((x) => x.slice(-6)).join(","));
if (!(order[0] === i1 && order[1] === i2)) throw new Error("append order wrong");

await addToCollection(cid, i3);
order = (await db.select().from(collectionItems).where(eq(collectionItems.collectionId, cid)).orderBy(asc(collectionItems.position))).map((r) => r.itemId);
if (!(order[2] === i3)) throw new Error("bulk append at end wrong");
console.log("✓ appends at end in wall order");

if ((await getItemCollections(i2)).length !== 1) throw new Error("membership lookup failed");
await renameCollection(cid, "E2E Renamed");
if (!(await listCollections()).find((c) => c.id === cid)?.name.includes("Renamed")) throw new Error("rename failed");
console.log("✓ rename + membership lookup");

await deleteCollection(cid);
if ((await getItemCollections(i2)).length !== 0) throw new Error("collection delete should keep items but clear memberships");
console.log("✓ deleting collection clears memberships, items survive");

// duplicate notice server path (drain any leftovers from prior runs first)
for (;;) {
  const prior = await findExistingByNormalizedUrl(normalize("https://example.com/dup-check"));
  if (!prior) break;
  await deleteItem(prior.itemId);
}
const url = "https://example.com/dup-check";
const linked = await createLinkedItem({ rawUrl: url });
const dressed = "HTTPS://Example.com/dup-check/?utm_source=test&utm_medium=e2e#top";
const hit = await findExistingByNormalizedUrl(dressed);
console.log("linked:", linked.itemId, "kind:", linked.kind);
console.log("hit:", JSON.stringify(hit));
if (!hit || hit.itemId !== linked.itemId) throw new Error("normalized duplicate lookup failed");

for (const id of [i1, i2, i3, linked.itemId]) await deleteItem(id);
console.log("collections + duplicate e2e passes");
