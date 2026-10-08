import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { smartCollections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { normalizeFilterState, type FilterState } from "@/lib/filter";
import { assertSmartCollectionOwned, ownerClause } from "@/lib/auth/owner";

export interface SavedSearch {
  id: string;
  name: string;
  state: FilterState;
}

export async function listSavedSearches(ownerId: string): Promise<SavedSearch[]> {
  const rows = await db
    .select()
    .from(smartCollections)
    .where(ownerClause(smartCollections.ownerId, ownerId))
    .orderBy(asc(smartCollections.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: normalizeFilterState({ ...(r.filterState as object), sort: r.sort }),
  }));
}

export async function saveSearch(ownerId: string, name: string, state: FilterState): Promise<string> {
  const id = newId();
  const clean = normalizeFilterState(state);
  await db.insert(smartCollections).values({ id, ownerId, name, filterState: clean, sort: clean.sort });
  return id;
}

export async function renameSavedSearch(ownerId: string, id: string, name: string): Promise<void> {
  await assertSmartCollectionOwned(ownerId, id);
  await db
    .update(smartCollections)
    .set({ name })
    .where(and(eq(smartCollections.id, id), ownerClause(smartCollections.ownerId, ownerId)));
}

export async function deleteSavedSearch(ownerId: string, id: string): Promise<void> {
  await assertSmartCollectionOwned(ownerId, id);
  await db.delete(smartCollections).where(and(eq(smartCollections.id, id), ownerClause(smartCollections.ownerId, ownerId)));
}
