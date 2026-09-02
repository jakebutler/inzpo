import { sql, type SQL } from "drizzle-orm";
import type { FilterState } from "@/lib/filter";

export interface WallQuery {
  where: SQL;
  orderBy: SQL;
}

function inList(values: string[]): SQL {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

export function buildWallQuery(state: FilterState, collectionId?: string | null): WallQuery {
  const conds: SQL[] = [sql`i.capture_state = 'ready'`];
  if (collectionId) {
    conds.push(sql`exists (select 1 from collection_items ci where ci.item_id = i.id and ci.collection_id = ${collectionId})`);
  }

  // kinds — any-of among includes, all excludes forbidden
  const includedKinds = Object.entries(state.kinds)
    .filter(([, stance]) => stance === "include")
    .map(([kind]) => kind);
  const excludedKinds = Object.entries(state.kinds)
    .filter(([, stance]) => stance === "exclude")
    .map(([kind]) => kind);
  if (includedKinds.length > 0) conds.push(sql`i.kind in (${inList(includedKinds)})`);
  if (excludedKinds.length > 0) conds.push(sql`i.kind not in (${inList(excludedKinds)})`);

  // facets — any-of within a facet for includes, AND across facets; excludes forbidden globally
  const includesByFacet = new Map<string, string[]>();
  for (const sel of state.facetValues) {
    if (sel.stance !== "include") continue;
    const list = includesByFacet.get(sel.facetId) ?? [];
    list.push(sel.value);
    includesByFacet.set(sel.facetId, list);
  }
  for (const [facetId, values] of includesByFacet) {
    conds.push(sql`exists (
      select 1 from item_facet_values ifv
      join facet_values fv on fv.id = ifv.facet_value_id
      where ifv.item_id = i.id and fv.facet_id = ${facetId}
        and lower(fv.value) in (${inList(values.map((v) => v.toLowerCase()))})
    )`);
  }
  const excludes = state.facetValues.filter((s) => s.stance === "exclude");
  if (excludes.length > 0) {
    const pairs = sql.join(
      excludes.map(
        (s) => sql`(fv.facet_id = ${s.facetId} and lower(fv.value) = ${s.value.toLowerCase()})`,
      ),
      sql` or `,
    );
    conds.push(sql`not exists (
      select 1 from item_facet_values ifv
      join facet_values fv on fv.id = ifv.facet_value_id
      where ifv.item_id = i.id and (${pairs})
    )`);
  }

  // free tags
  const includedTags = state.freeTags.filter((t) => t.stance === "include").map((t) => t.name.toLowerCase());
  const excludedTags = state.freeTags.filter((t) => t.stance === "exclude").map((t) => t.name.toLowerCase());
  if (includedTags.length > 0) {
    conds.push(sql`exists (
      select 1 from item_free_tags ift
      join free_tags ft on ft.id = ift.free_tag_id
      where ift.item_id = i.id and lower(ft.name) in (${inList(includedTags)})
    )`);
  }
  if (excludedTags.length > 0) {
    conds.push(sql`not exists (
      select 1 from item_free_tags ift
      join free_tags ft on ft.id = ift.free_tag_id
      where ift.item_id = i.id and lower(ft.name) in (${inList(excludedTags)})
    )`);
  }

  // colors — any carried color maps to the family
  const includedColors = state.colors.filter((c) => c.stance === "include").map((c) => c.family);
  const excludedColors = state.colors.filter((c) => c.stance === "exclude").map((c) => c.family);
  if (includedColors.length > 0) {
    conds.push(sql`exists (select 1 from item_colors c where c.item_id = i.id and c.family in (${inList(includedColors)}))`);
  }
  if (excludedColors.length > 0) {
    conds.push(sql`not exists (select 1 from item_colors c where c.item_id = i.id and c.family in (${inList(excludedColors)}))`);
  }

  // text search — plain substring over the §5.4 reach
  const q = state.q.trim();
  if (q.length > 0) {
    const needle = `%${q.toLowerCase()}%`;
    conds.push(sql`(
      (i.title is not null and lower(i.title) like ${needle})
      or (i.note is not null and lower(i.note) like ${needle})
      or exists (
        select 1 from item_facet_values ifv
        join facet_values fv on fv.id = ifv.facet_value_id
        where ifv.item_id = i.id and fv.value ilike ${needle}
      )
      or exists (
        select 1 from item_free_tags ift
        join free_tags ft on ft.id = ift.free_tag_id
        where ift.item_id = i.id and ft.name ilike ${needle}
      )
      or exists (
        select 1 from item_sources s
        where s.item_id = i.id
          and (s.title ilike ${needle} or s.description ilike ${needle} or s.url ilike ${needle})
      )
    )`);
  }

  const where = sql.join(conds, sql` and `);

  let orderBy: SQL;
  switch (state.sort) {
    case "oldest":
      orderBy = sql`i.created_at asc`;
      break;
    case "title":
      orderBy = sql`(i.title is null) asc, lower(coalesce(i.title, '')) asc, i.created_at desc`;
      break;
    case "shuffle":
      orderBy = sql`random()`;
      break;
    default:
      orderBy = sql`i.created_at desc`;
  }

  return { where, orderBy };
}

export function buildWallFrom(state: FilterState): SQL {
  const { where, orderBy } = buildWallQuery(state);
  return sql`from items i where ${where} order by ${orderBy}`;
}
