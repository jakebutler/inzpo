if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { sql } = await import("drizzle-orm");
const { db } = await import("../lib/db");
const { facets, facetValues } = await import("../lib/db/schema");
const { FACET_SEEDS } = await import("../lib/ontology-seeds");
const { newId } = await import("../lib/ids");

for (const seed of FACET_SEEDS) {
  const existing = await db.select({ id: facets.id }).from(facets).where(sql`lower(name) = lower(${seed.name})`).limit(1);
  let facetId = existing[0]?.id;
  if (!facetId) {
    facetId = newId();
    await db.insert(facets).values({ id: facetId, name: seed.name, position: seed.position });
    console.log("facet seeded:", seed.name);
  }
  for (const value of seed.values) {
    const has = await db
      .select({ id: facetValues.id })
      .from(facetValues)
      .where(sql`facet_id = ${facetId} and lower(value) = lower(${value})`)
      .limit(1);
    if (!has[0]) {
      await db.insert(facetValues).values({ id: newId(), facetId, value }).onConflictDoNothing();
    }
  }
  console.log(`values ensured for ${seed.name}: ${seed.values.length}`);
}
console.log("ontology seeds applied");
