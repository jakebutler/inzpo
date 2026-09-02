if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem, getWallItems, countWallItems, deleteItem } = await import("../lib/items");
const { attachTags } = await import("../lib/ontology");
const { getFacetsWithValues } = await import("../lib/ontology");
const { saveSearch, listSavedSearches, renameSavedSearch, deleteSavedSearch } = await import("../lib/saved-searches");
const { EMPTY_FILTER, activeFilterCount } = await import("../lib/filter");

function img(r: number, g: number, b: number) {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

const facets = await getFacetsWithValues();
const style = facets.find((f) => f.name === "Style")!;
const mood = facets.find((f) => f.name === "Mood")!;

const ids: string[] = [];
async function make(filename: string, color: [number, number, number], tags: Parameters<typeof attachTags>[1]) {
  const id = await createImageItem({ buffer: await img(...color), filename });
  await attachTags(id, tags);
  ids.push(id);
  return id;
}

const a = await make("minimal blue.png", [30, 100, 200], { facetValues: [{ facetId: style.id, value: "minimal" }], freeTags: [] });
const b = await make("minimal calm.png", [40, 110, 210], {
  facetValues: [
    { facetId: style.id, value: "minimal" },
    { facetId: mood.id, value: "calm" },
  ],
  freeTags: [],
});
const c = await make("brutalist red.png", [200, 40, 40], { facetValues: [{ facetId: style.id, value: "brutalist" }], freeTags: [] });
const d = await make("tagged green.png", [40, 160, 80], { facetValues: [], freeTags: ["inspo"] });

const empty = { ...EMPTY_FILTER };
const f = (over: object) => ({ ...EMPTY_FILTER, ...over });
const idsOf = (items: Awaited<ReturnType<typeof getWallItems>>) => items.map((i) => i.id).filter((id) => ids.includes(id));

let failures = 0;
function expectSet(label: string, got: string[], expected: string[]) {
  const ok = got.length === expected.length && got.every((g) => expected.includes(g));
  if (!ok) {
    failures++;
    console.log(`✗ ${label}: got [${got.join(", ")}] expected [${expected.join(", ")}]`);
  } else {
    console.log(`✓ ${label} -> ${got.length}`);
  }
}

// 1. any-of within a facet
expectSet("include Style:minimal", idsOf(await getWallItems(f({ facetValues: [{ facetId: style.id, value: "minimal", stance: "include" }] }))), [a, b]);

// 2. AND across facets
expectSet(
  "include Style:minimal AND Mood:calm",
  idsOf(await getWallItems(f({ facetValues: [
    { facetId: style.id, value: "minimal", stance: "include" },
    { facetId: mood.id, value: "calm", stance: "include" },
  ] }))),
  [b],
);

// 3. tri-state exclude
expectSet("exclude Style:minimal", idsOf(await getWallItems(f({ facetValues: [{ facetId: style.id, value: "minimal", stance: "exclude" }] }))), [c, d]);

// 4. include + exclude in same dimension
expectSet(
  "include Mood:calm, exclude Style:minimal -> none",
  idsOf(await getWallItems(f({ facetValues: [
    { facetId: mood.id, value: "calm", stance: "include" },
    { facetId: style.id, value: "minimal", stance: "exclude" },
  ] }))),
  [],
);

// 5. free tags
expectSet("include free tag inspo", idsOf(await getWallItems(f({ freeTags: [{ name: "inspo", stance: "include" }] }))), [d]);

// 6. colors — any-carried-color family match
expectSet("include blue family", idsOf(await getWallItems(f({ colors: [{ family: "blue", stance: "include" }] }))), [a, b]);
expectSet("include red family", idsOf(await getWallItems(f({ colors: [{ family: "red", stance: "include" }] }))), [c]);

// 7. text search reaches facet values + free tags + filenames
expectSet("q=minimal (facet values)", idsOf(await getWallItems(f({ q: "minimal" }))), [a, b]);
expectSet("q=inspo (free tags)", idsOf(await getWallItems(f({ q: "inspo" }))), [d]);
expectSet("q=brutalist (facet)", idsOf(await getWallItems(f({ q: "brutalist" }))), [c]);

// 8. kinds
expectSet("kind include photo", idsOf(await getWallItems(f({ kinds: { photo: "include" } }))), [a, b, c, d]);
expectSet("kind exclude photo", idsOf(await getWallItems(f({ kinds: { photo: "exclude" } }))), []);

// 9. sorts run without error
for (const sort of ["newest", "oldest", "title", "shuffle"] as const) {
  await getWallItems(f({ sort }));
  console.log(`✓ sort=${sort}`);
}
const allPhoto = await getWallItems(f({ kinds: { photo: "include" } }));
const count = await countWallItems(f({ kinds: { photo: "include" } }));
if (count !== allPhoto.length) throw new Error(`count ${count} != resolution ${allPhoto.length}`);

// 10. active count + saved-search round trip
if (activeFilterCount(f({ q: "x", freeTags: [{ name: "t", stance: "include" }] })) !== 2) throw new Error("active count wrong");
const savedId = await saveSearch("e2e saved", f({ facetValues: [{ facetId: style.id, value: "minimal", stance: "include" }] }));
const saved = (await listSavedSearches()).find((s) => s.id === savedId)!;
expectSet("saved search applies", idsOf(await getWallItems(saved.state)), [a, b]);
await renameSavedSearch(savedId, "e2e saved renamed");
if (!(await listSavedSearches()).find((s) => s.id === savedId)?.name.includes("renamed")) throw new Error("rename failed");
await deleteSavedSearch(savedId);
if ((await listSavedSearches()).find((s) => s.id === savedId)) throw new Error("delete failed");
console.log("✓ saved-search save/apply/rename/delete");

for (const id of ids) await deleteItem(id);
if (failures > 0) throw new Error(`${failures} filter assertions failed`);
console.log("filter engine e2e passes");
