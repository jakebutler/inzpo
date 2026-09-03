if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { deleteItem } = await import("../lib/items");
const { db } = await import("../lib/db");
const { sql } = await import("drizzle-orm");
const { renameFacetValue, removeFacetValue, removeFreeTag } = await import("../lib/vocab");
const { deleteCollection } = await import("../lib/collections");
const { getFacetsWithValues } = await import("../lib/ontology");
const { deleteItem: _d } = { deleteItem: null };
void _d;

// 1. leaked items from crashed e2e runs
const patterns: Array<[string, string]> = [
  [`kind = 'photo' and title in ('one', 'two', 'three')`, "one/two/three photos"],
  [`title like 'inzpo e2e%'`, "browser e2e photos"],
  [`kind = 'article' and title like 'An Interactive Guide%'`, "leaked article"],
  [`kind = 'video' and title like 'Rick Astley%'`, "leaked video"],
  [`id in (select item_id from item_sources where url_normalized = 'https://example.com')`, "example.com captures"],
];
for (const [cond, label] of patterns) {
  const rows = await db.execute(sql`select id, title from items i where ${sql.raw(cond)}`);
  for (const row of rows.rows as Array<{ id: string; title: string }>) {
    await deleteItem(row.id);
    console.log(`deleted [${label}]:`, (row.title ?? "Untitled").slice(0, 50));
  }
}

// 2. restore seed vocabulary polluted by the vocab e2e
let facets = await getFacetsWithValues();
const style = facets.find((f) => f.name === "Style")!;
if (style.values.some((v) => v.value === "minimal-renamed")) {
  await renameFacetValue(style.id, "minimal-renamed", "minimal");
  console.log("restored seed value: minimal");
}
facets = await getFacetsWithValues();
const style2 = facets.find((f) => f.name === "Style")!;
for (const candidate of ["sharedtag-renamed", "a brand new value", "bulk-probe", "bulk-target"]) {
  const v = style2.values.find((x) => x.value === candidate);
  if (v) {
    if (v.usage > 0) {
      console.log(`skip ${candidate}: still used by ${v.usage}`);
    } else {
      await removeFacetValue(v.id);
      console.log("removed unused e2e value:", candidate);
    }
  }
}

const tagRows = await db.execute(sql`select id, name from free_tags where name in ('bulktag', 'sharedtag', 'sharedtag-renamed')`);
for (const t of tagRows.rows as Array<{ id: string; name: string }>) {
  await removeFreeTag(t.id);
  console.log("removed e2e free tag:", t.name);
}

// 3. leftover collections
const cols = await db.execute(sql`select id, name from collections where name in ('E2E Collection', 'bulk e2e')`);
for (const c of cols.rows as Array<{ id: string; name: string }>) {
  await deleteCollection(c.id);
  console.log("removed e2e collection:", c.name);
}

// 4. state report
const remaining = await db.execute(sql`select count(*)::int as n from items`);
const saved = await db.execute(sql`select name from smart_collections`);
const styleFinal = (await getFacetsWithValues()).find((f) => f.name === "Style")!;
console.log("items remaining:", (remaining.rows[0] as { n: number }).n);
console.log("saved searches:", JSON.stringify((saved.rows as Array<{ name: string }>).map((r) => r.name)));
console.log("Style values:", styleFinal.values.map((v) => v.value).join(", "));
