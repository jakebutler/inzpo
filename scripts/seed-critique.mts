if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const sharp = (await import("sharp")).default;
const { createImageItem } = await import("../lib/items");
const { createLinkedItem } = await import("../lib/capture-url");
const { attachTags } = await import("../lib/ontology");
const { db } = await import("../lib/db");
const { sql } = await import("drizzle-orm");

const ids: string[] = [];
const img = (r: number, g: number, b: number, w = 900, h = 600) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();

const p1 = await createImageItem({ buffer: await img(212, 106, 62, 1200, 800), filename: "brutalist poster study.png" });
await attachTags(p1, { facetValues: [{ facet: "Style", value: "brutalist" }, { facet: "Medium", value: "print" }], freeTags: ["poster"] });
ids.push(p1);

const p2 = await createImageItem({ buffer: await img(30, 90, 160, 700, 1000), filename: "swiss layout grid.png" });
await attachTags(p2, { facetValues: [{ facet: "Style", value: "swiss" }, { facet: "Complexity", value: "airy" }], freeTags: [] });
ids.push(p2);

const a1 = await createLinkedItem({ rawUrl: "https://www.joshwcomeau.com/animation/css-transitions/" });
ids.push(a1.itemId);
const v1 = await createLinkedItem({ rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
ids.push(v1.itemId);

const existing = await db.execute(sql`select id from items`);
console.log(JSON.stringify({ seedIds: ids, total: (existing.rows as Array<{ id: string }>).length }));
await (await import("node:fs")).promises.writeFile("/tmp/critique-seed-ids.json", JSON.stringify(ids));
