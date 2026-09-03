import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { facetValues, facets, freeTags, itemFacetValues, itemFreeTags } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import type { TagSelection } from "@/lib/tags";

export { parseTagSelection } from "@/lib/tags";
export type { TagSelection } from "@/lib/tags";

export interface FacetWithValues {
  id: string;
  name: string;
  values: Array<{ id: string; value: string; usage: number }>;
}

export async function getFacetsWithValues(): Promise<FacetWithValues[]> {
  const rows = await db
    .select({
      id: facets.id,
      name: facets.name,
      valueId: facetValues.id,
      value: facetValues.value,
      usage: sql<number>`(select count(*)::int from item_facet_values ifv where ifv.facet_value_id = ${facetValues.id})`,
    })
    .from(facets)
    .leftJoin(facetValues, eq(facetValues.facetId, facets.id))
    .orderBy(asc(facets.position), asc(facetValues.value));

  const byFacet = new Map<string, FacetWithValues>();
  for (const row of rows) {
    let facet = byFacet.get(row.id);
    if (!facet) {
      facet = { id: row.id, name: row.name, values: [] };
      byFacet.set(row.id, facet);
    }
    if (row.valueId && row.value) {
      facet.values.push({ id: row.valueId, value: row.value, usage: row.usage });
    }
  }
  return [...byFacet.values()];
}

export async function ensureFacetValue(facetId: string, value: string): Promise<string> {
  const existing = await db
    .select({ id: facetValues.id })
    .from(facetValues)
    .where(sql`${facetValues.facetId} = ${facetId} and lower(${facetValues.value}) = lower(${value})`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = newId();
  await db.insert(facetValues).values({ id, facetId, value }).onConflictDoNothing();
  const row = await db
    .select({ id: facetValues.id })
    .from(facetValues)
    .where(sql`${facetValues.facetId} = ${facetId} and lower(${facetValues.value}) = lower(${value})`)
    .limit(1);
  return row[0].id;
}

export async function ensureFreeTag(name: string): Promise<string> {
  const existing = await db
    .select({ id: freeTags.id })
    .from(freeTags)
    .where(sql`lower(${freeTags.name}) = lower(${name})`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = newId();
  await db.insert(freeTags).values({ id, name }).onConflictDoNothing();
  const row = await db
    .select({ id: freeTags.id })
    .from(freeTags)
    .where(sql`lower(${freeTags.name}) = lower(${name})`)
    .limit(1);
  return row[0].id;
}

async function facetIdForName(name: string): Promise<string | null> {
  const rows = await db.select({ id: facets.id }).from(facets).where(sql`lower(${facets.name}) = lower(${name})`).limit(1);
  return rows[0]?.id ?? null;
}

export async function attachTags(itemId: string, selection: TagSelection): Promise<void> {
  for (const entry of selection.facetValues) {
    let facetId = entry.facetId;
    if (!facetId && entry.facet) {
      facetId = (await facetIdForName(entry.facet)) ?? undefined;
    }
    if (!facetId) continue;
    const valueId = await ensureFacetValue(facetId, entry.value);
    await db.insert(itemFacetValues).values({ itemId, facetValueId: valueId }).onConflictDoNothing();
  }
  for (const name of selection.freeTags) {
    const tagId = await ensureFreeTag(name);
    await db.insert(itemFreeTags).values({ itemId, freeTagId: tagId }).onConflictDoNothing();
  }
}

export interface ItemTags {
  facetTags: Array<{ facet: string; value: string }>;
  freeTags: string[];
}

export async function getItemTags(itemId: string): Promise<ItemTags> {
  const facetRows = await db
    .select({ facet: facets.name, value: facetValues.value })
    .from(itemFacetValues)
    .innerJoin(facetValues, eq(facetValues.id, itemFacetValues.facetValueId))
    .innerJoin(facets, eq(facets.id, facetValues.facetId))
    .where(eq(itemFacetValues.itemId, itemId));
  const freeRows = await db
    .select({ name: freeTags.name })
    .from(itemFreeTags)
    .innerJoin(freeTags, eq(freeTags.id, itemFreeTags.freeTagId))
    .where(eq(itemFreeTags.itemId, itemId));
  return {
    facetTags: facetRows.map((r) => ({ facet: r.facet, value: r.value })),
    freeTags: freeRows.map((r) => r.name),
  };
}
