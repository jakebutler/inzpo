import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { facetValues, freeTags, itemFacetValues, itemFreeTags, smartCollections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { normalizeFilterState, type FilterState } from "@/lib/filter";

async function rewriteSavedStates(fn: (state: FilterState) => FilterState): Promise<void> {
  const rows = await db.select().from(smartCollections);
  for (const row of rows) {
    const before = normalizeFilterState(row.filterState);
    const after = fn(before);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      await db
        .update(smartCollections)
        .set({ filterState: after, sort: after.sort })
        .where(eq(smartCollections.id, row.id));
    }
  }
}

export async function renameFacetValue(facetId: string, oldValue: string, newValue: string): Promise<void> {
  const clean = newValue.trim().slice(0, 60);
  if (clean.length === 0) throw new Error("Empty name");
  const result = await db
    .update(facetValues)
    .set({ value: clean })
    .where(sql`${facetValues.facetId} = ${facetId} and lower(${facetValues.value}) = lower(${oldValue})`)
    .returning({ id: facetValues.id });
  if (result.length === 0) return;
  await rewriteSavedStates((state) => ({
    ...state,
    facetValues: state.facetValues.map((s) =>
      s.facetId === facetId && s.value.toLowerCase() === oldValue.toLowerCase() ? { ...s, value: clean } : s,
    ),
  }));
}

export async function mergeFacetValues(facetId: string, survivorId: string, mergeValueIds: string[]): Promise<void> {
  const all = [survivorId, ...mergeValueIds];
  const values = await db.select().from(facetValues).where(sql`${facetValues.id} = any(${sql.raw(`array['${all.join("','")}']::text[]`)})`);
  const survivor = values.find((v) => v.id === survivorId);
  if (!survivor) throw new Error("Survivor not found");
  const survivorLower = survivor.value.toLowerCase();

  // repoint assignments that target merged values, skipping items that already carry the survivor
  await db.execute(sql`
    update item_facet_values ifv
    set facet_value_id = ${survivorId}
    where ifv.facet_value_id in (${sql.join(
      mergeValueIds.map((mid) => sql`${mid}`),
      sql`, `,
    )})
      and exists (select 1 from item_facet_values keep where keep.item_id = ifv.item_id and keep.facet_value_id = ${survivorId}) = false
  `);
  // delete leftover duplicates (items carrying both)
  await db.execute(sql`
    delete from item_facet_values
    where facet_value_id in (${sql.join(
      mergeValueIds.map((mid) => sql`${mid}`),
      sql`, `,
    )})
  `);
  await db.delete(facetValues).where(sql`${facetValues.id} in (${sql.join(
    mergeValueIds.map((mid) => sql`${mid}`),
    sql`, `,
  )})`);

  const mergedNames = values.filter((v) => v.id !== survivorId).map((v) => v.value.toLowerCase());
  await rewriteSavedStates((state) => {
    const seen = new Set<string>();
    const facetValues = state.facetValues
      .map((s) => {
        if (s.facetId !== facetId) return s;
        const lower = s.value.toLowerCase();
        if (lower === survivorLower || mergedNames.includes(lower)) {
          const key = `${s.stance}:${survivorLower}`;
          if (seen.has(key)) return null;
          seen.add(key);
          return { ...s, value: survivor.value };
        }
        return s;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    return { ...state, facetValues };
  });
}

export async function removeFacetValue(facetValueId: string): Promise<void> {
  const usage = await db.execute(sql`select count(*)::int as n from item_facet_values where facet_value_id = ${facetValueId}`);
  if ((usage.rows[0] as { n: number }).n > 0) throw new Error("Value is still in use — merge instead");
  await db.delete(facetValues).where(eq(facetValues.id, facetValueId));
  await rewriteSavedStates((state) => ({ ...state }));
}

export async function createFacetValue(facetId: string, value: string): Promise<void> {
  const clean = value.trim().slice(0, 60);
  if (clean.length === 0) throw new Error("Empty name");
  const existing = await db
    .select({ id: facetValues.id })
    .from(facetValues)
    .where(sql`${facetValues.facetId} = ${facetId} and lower(${facetValues.value}) = lower(${clean})`)
    .limit(1);
  if (existing.length === 0) {
    await db.insert(facetValues).values({ id: newId(), facetId, value: clean }).onConflictDoNothing();
  }
}

export async function renameFreeTag(tagId: string, newName: string): Promise<void> {
  const clean = newName.trim().slice(0, 60);
  if (clean.length === 0) throw new Error("Empty name");
  const rows = await db.select({ name: freeTags.name }).from(freeTags).where(eq(freeTags.id, tagId)).limit(1);
  const old = rows[0]?.name;
  if (!old) return;
  await db.update(freeTags).set({ name: clean }).where(eq(freeTags.id, tagId));
  await rewriteSavedStates((state) => ({
    ...state,
    freeTags: state.freeTags.map((t) => (t.name.toLowerCase() === old.toLowerCase() ? { ...t, name: clean } : t)),
  }));
}

export async function removeFreeTag(tagId: string): Promise<void> {
  const usage = await db.execute(sql`select count(*)::int as n from item_free_tags where free_tag_id = ${tagId}`);
  if ((usage.rows[0] as { n: number }).n > 0) throw new Error("Tag is still in use");
  await db.delete(freeTags).where(eq(freeTags.id, tagId));
  await rewriteSavedStates((state) => ({ ...state }));
}

export async function promoteFreeTag(tagId: string, targetFacetId: string): Promise<void> {
  const rows = await db.select().from(freeTags).where(eq(freeTags.id, tagId)).limit(1);
  const tag = rows[0];
  if (!tag) return;

  // ensure the facet value exists
  let valueId: string;
  const existing = await db
    .select({ id: facetValues.id })
    .from(facetValues)
    .where(sql`${facetValues.facetId} = ${targetFacetId} and lower(${facetValues.value}) = lower(${tag.name})`)
    .limit(1);
  if (existing[0]) {
    valueId = existing[0].id;
  } else {
    valueId = newId();
    await db.insert(facetValues).values({ id: valueId, facetId: targetFacetId, value: tag.name }).onConflictDoNothing();
    const again = await db
      .select({ id: facetValues.id })
      .from(facetValues)
      .where(sql`${facetValues.facetId} = ${targetFacetId} and lower(${facetValues.value}) = lower(${tag.name})`)
      .limit(1);
    valueId = again[0].id;
  }

  // every carrier gains the value; the tag dissolves
  await db.execute(sql`
    insert into item_facet_values (item_id, facet_value_id)
    select item_id, ${valueId} from item_free_tags where free_tag_id = ${tagId}
    on conflict do nothing
  `);
  await db.delete(itemFreeTags).where(eq(itemFreeTags.freeTagId, tagId));
  await db.delete(freeTags).where(eq(freeTags.id, tagId));

  await rewriteSavedStates((state) => {
    const promoted = state.freeTags.filter((t) => t.name.toLowerCase() === tag.name.toLowerCase());
    const freeTags = state.freeTags.filter((t) => t.name.toLowerCase() !== tag.name.toLowerCase());
    const facetValues = [...state.facetValues];
    for (const p of promoted) {
      const dup = facetValues.some((s) => s.facetId === targetFacetId && s.value.toLowerCase() === tag.name.toLowerCase() && s.stance === p.stance);
      if (!dup) facetValues.push({ facetId: targetFacetId, value: tag.name, stance: p.stance });
    }
    return { ...state, freeTags, facetValues };
  });
}
