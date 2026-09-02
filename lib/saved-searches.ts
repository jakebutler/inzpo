import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { smartCollections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { normalizeFilterState, type FilterState } from "@/lib/filter";

export interface SavedSearch {
  id: string;
  name: string;
  state: FilterState;
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const rows = await db.select().from(smartCollections).orderBy(asc(smartCollections.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: normalizeFilterState({ ...(r.filterState as object), sort: r.sort }),
  }));
}

export async function saveSearch(name: string, state: FilterState): Promise<string> {
  const id = newId();
  const clean = normalizeFilterState(state);
  await db.insert(smartCollections).values({ id, name, filterState: clean, sort: clean.sort });
  return id;
}

export async function renameSavedSearch(id: string, name: string): Promise<void> {
  await db.update(smartCollections).set({ name }).where(eq(smartCollections.id, id));
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await db.delete(smartCollections).where(eq(smartCollections.id, id));
}
