if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { TEST_OWNER_ID: OWNER } = await import("../lib/auth/owner-ids");
const { createImageItem, getWallItems, deleteItem } = await import("../lib/items");
const { attachTags } = await import("../lib/ontology");
const { getFacetsWithValues, seedFacetsForOwner } = await import("../lib/ontology");
await seedFacetsForOwner(OWNER);
const { renameFacetValue, mergeFacetValues, removeFacetValue, promoteFreeTag, renameFreeTag } = await import("../lib/vocab");
const { saveSearch, listSavedSearches, deleteSavedSearch } = await import("../lib/saved-searches");
const { EMPTY_FILTER } = await import("../lib/filter");

function img() {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 100, b: 100 } } }).png().toBuffer();
}

const facets = await getFacetsWithValues(OWNER);
const style = facets.find((f) => f.name === "Style")!;

const i1 = await createImageItem({ ownerId: OWNER, buffer: await img(), filename: "v1.png" });
const i2 = await createImageItem({ ownerId: OWNER, buffer: await img(), filename: "v2.png" });
await attachTags(OWNER, i1, { facetValues: [{ facetId: style.id, value: "minimal" }], freeTags: [] });
await attachTags(OWNER, i2, { facetValues: [{ facetId: style.id, value: "swiss" }], freeTags: ["sharedtag"] });

// rename propagates into saved queries
const savedId = await saveSearch(OWNER, "rename probe", { ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "minimal", stance: "include" }] });
await renameFacetValue(OWNER, style.id, "minimal", "minimal-renamed");
const saved = (await listSavedSearches(OWNER)).find((s) => s.id === savedId)!;
const renamed = saved.state.facetValues.some((s) => s.value === "minimal-renamed");
console.log("rename propagates into saved query:", renamed ? "✓" : "✗");
if (!renamed) throw new Error("rename propagation failed");

// resolve items by renamed value
const wall = await getWallItems(OWNER, { ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "minimal-renamed", stance: "include" }] });
if (!wall.some((w) => w.id === i1)) throw new Error("renamed value lost assignments");
console.log("assignments follow rename ✓");

// remove-if-unused gating: minimal-renamed is used -> must throw
let gated = false;
try {
  const f2 = (await getFacetsWithValues(OWNER)).find((f) => f.id === style.id)!;
  const v = f2.values.find((x) => x.value === "minimal-renamed")!;
  await removeFacetValue(OWNER, v.id);
} catch {
  gated = true;
}
console.log("remove-if-unused gated:", gated ? "✓" : "✗ NOT GATED");
if (!gated) throw new Error("removal gate failed");

// merge swiss into minimal-renamed
const f2 = (await getFacetsWithValues(OWNER)).find((f) => f.id === style.id)!;
const survivor = f2.values.find((v) => v.value === "minimal-renamed")!;
const swiss = f2.values.find((v) => v.value === "swiss")!;
await mergeFacetValues(OWNER, style.id, survivor.id, [swiss.id]);
const wall2 = await getWallItems(OWNER, { ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "minimal-renamed", stance: "include" }] });
console.log("merge moves assignments:", wall2.some((w) => w.id === i2) ? "✓" : "✗");
if (!wall2.some((w) => w.id === i2)) throw new Error("merge did not move assignments");

// free tag rename + promotion
const { db } = await import("../lib/db");
const { freeTags } = await import("../lib/db/schema");
const tagRow = (await db.select().from(freeTags).where(sql`lower(name) = 'sharedtag-renamed'`))[0] ?? (await db.select().from(freeTags).where(sql`lower(name) = 'sharedtag'`))[0];
await renameFreeTag(OWNER, tagRow.id, "sharedtag-renamed");
await promoteFreeTag(OWNER, tagRow.id, style.id);
const after = await getWallItems(OWNER, { ...EMPTY_FILTER, facetValues: [{ facetId: style.id, value: "sharedtag-renamed", stance: "include" }] });
console.log("promotion carries item:", after.some((w) => w.id === i2) ? "✓" : "✗");
if (!after.some((w) => w.id === i2)) throw new Error("promotion failed");
const tagsLeft = await db.select().from(freeTags).where(sql`lower(name) = 'sharedtag-renamed'`);
if (tagsLeft.length > 0) throw new Error("tag did not dissolve");
console.log("tag dissolved ✓");
const savedAfter = (await listSavedSearches(OWNER)).find((s) => s.id === savedId);
void savedAfter;

await deleteSavedSearch(OWNER, savedId);
for (const id of [i1, i2]) await deleteItem(OWNER, id);
console.log("vocab manager e2e passes");

import { sql } from "drizzle-orm";
