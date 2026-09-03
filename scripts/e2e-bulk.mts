if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, getWallItems, deleteItem, getItemDetail } = await import("../lib/items");
const { attachTags, getItemTags } = await import("../lib/ontology");
const { getFacetsWithValues } = await import("../lib/ontology");
const { createCollection, addToCollection, deleteCollection } = await import("../lib/collections");
const { EMPTY_FILTER } = await import("../lib/filter");
const { db } = await import("../lib/db");
const { collectionItems } = await import("../lib/db/schema");
const { eq, sql } = await import("drizzle-orm");

function img() {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 120, g: 120, b: 120 } } }).png().toBuffer();
}

const facets = await getFacetsWithValues();
const style = facets.find((f) => f.name === "Style")!;

const ids: string[] = [];
for (const n of ["b1", "b2", "b3"]) {
  const id = await createImageItem({ buffer: await img(), filename: `${n}.png` });
  await attachTags(id, { facetValues: [{ facetId: style.id, value: "bulk-probe" }], freeTags: [] });
  ids.push(id);
}

// bulk assign facet value + free tag (the helper the action uses)
for (const id of ids) await attachTags(id, { facetValues: [{ facetId: style.id, value: "bulk-target" }], freeTags: ["bulktag"] });
const t1 = await getItemTags(ids[0]);
if (!t1.facetTags.some((t) => t.value === "bulk-target")) throw new Error("bulk assign failed");
if (!t1.freeTags.includes("bulktag")) throw new Error("bulk free tag assign failed");
console.log("bulk assign (facet value + free tag) OK");

// bulk remove the same tags
for (const id of ids) {
  await db.execute(sql`
    delete from item_facet_values
    where item_id = ${id} and facet_value_id in (select id from facet_values where lower(value) = 'bulk-target')
  `);
  await db.execute(sql`
    delete from item_free_tags
    where item_id = ${id} and free_tag_id in (select id from free_tags where lower(name) = 'bulktag')
  `);
}
const t2 = await getItemTags(ids[0]);
if (t2.facetTags.some((t) => t.value === "bulk-target") || t2.freeTags.includes("bulktag")) throw new Error("bulk remove failed");
console.log("bulk remove OK");

// collection append in wall order
const cid = await createCollection("bulk e2e");
const wallOrder = (await getWallItems({ ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "bulk-probe", stance: "include" }] }))
  .filter((w) => ids.includes(w.id))
  .map((w) => w.id);
for (const id of wallOrder) await addToCollection(cid, id);
const order = (await db.select().from(collectionItems).where(eq(collectionItems.collectionId, cid)).orderBy(collectionItems.position)).map((r) => r.itemId);
if (JSON.stringify(order) !== JSON.stringify(wallOrder)) throw new Error("wall-order append wrong");
console.log("collection add appends in wall order OK");

// count-honest select-all: resolution count matches wall items for the same state
const all = await getWallItems({ ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "bulk-probe", stance: "include" }] });
if (all.length !== 3) throw new Error("select-all resolution wrong");
console.log("select-all = whole filter resolution OK");

await deleteCollection(cid);
for (const id of ids) await deleteItem(id);
console.log("bulk operations e2e passes");
