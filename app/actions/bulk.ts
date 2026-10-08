"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attachTags } from "@/lib/ontology";
import type { TagSelection } from "@/lib/tags";
import { deleteItem } from "@/lib/items";
import { buildWallQuery } from "@/lib/wall-query";
import { parseFilterParam } from "@/lib/filter";
import { addToCollection, collectionExists, createCollection, removeFromCollection } from "@/lib/collections";
import { sql } from "drizzle-orm";
import { requireOwnerId } from "@/lib/auth/owner";

export async function resolveIds(formData: FormData): Promise<string[]> {
  const ownerId = await requireOwnerId();
  const all = formData.get("all") === "1";
  if (all) {
    const state = parseFilterParam(formData.get("f") as string | null);
    const c = formData.get("c");
    const collectionId = typeof c === "string" && (await collectionExists(ownerId, c)) ? c : null;
    const { where } = buildWallQuery(state, collectionId, ownerId);
    const rows = await db.execute(sql`select i.id from items i where ${where}`);
    return (rows.rows as Array<{ id: string }>).map((x) => x.id);
  }
  return formData.getAll("ids").filter((v): v is string => typeof v === "string");
}

function refresh() {
  revalidatePath("/");
}

function tagsFromForm(fd: FormData): TagSelection {
  const facetId = fd.get("facetId");
  const facetValue = ((fd.get("facetValue") as string) ?? "").trim();
  const freeTagName = ((fd.get("freeTagName") as string) ?? "").trim();
  return {
    facetValues: typeof facetId === "string" && facetValue ? [{ facetId, value: facetValue }] : [],
    freeTags: freeTagName ? [freeTagName] : [],
  };
}

export async function bulkAssignTagsAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const ids = await resolveIds(formData);
  const tags = tagsFromForm(formData);
  if (ids.length === 0 || (tags.facetValues.length === 0 && tags.freeTags.length === 0)) return;
  for (const id of ids) await attachTags(ownerId, id, tags);
  refresh();
}

export async function bulkRemoveTagsAction(formData: FormData): Promise<void> {
  await requireOwnerId();
  const ids = await resolveIds(formData);
  const tags = tagsFromForm(formData);
  if (ids.length === 0) return;

  for (const { facetId, value } of tags.facetValues) {
    await db.execute(sql`
      delete from item_facet_values
      where item_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
        and facet_value_id in (
          select fv.id from facet_values fv where fv.facet_id = ${facetId} and lower(fv.value) = lower(${value})
        )
    `);
  }
  for (const name of tags.freeTags) {
    await db.execute(sql`
      delete from item_free_tags
      where item_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
        and free_tag_id in (select ft.id from free_tags ft where lower(ft.name) = lower(${name}))
    `);
  }
  refresh();
}

export async function bulkCollectionAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const ids = await resolveIds(formData);
  const op = formData.get("op") === "remove" ? "remove" : "add";
  let collectionId = (formData.get("collectionId") as string) ?? "";
  const newName = ((formData.get("newName") as string) ?? "").trim();
  if (ids.length === 0) return;
  if (op === "add") {
    if (!collectionId && newName.length > 0) collectionId = await createCollection(ownerId, newName);
    if (!collectionId) return;
    for (const id of ids) await addToCollection(ownerId, collectionId, id);
  } else if (collectionId) {
    for (const id of ids) await removeFromCollection(ownerId, collectionId, id);
  }
  refresh();
}

export async function bulkDeleteAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const ids = await resolveIds(formData);
  for (const id of ids) await deleteItem(ownerId, id);
  refresh();
}
