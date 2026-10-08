if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { LEGACY_OWNER_ID } = await import("../lib/auth/owner-ids");
const { seedFacetsForOwner } = await import("../lib/ontology");

const ownerId = process.env.SEED_OWNER_ID?.trim() || LEGACY_OWNER_ID;
await seedFacetsForOwner(ownerId);
console.log("ontology seeds applied for", ownerId);
