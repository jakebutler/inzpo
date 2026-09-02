import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems, collections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  count: number;
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      count: sql<number>`(select count(*)::int from collection_items ci where ci.collection_id = ${collections.id})`,
    })
    .from(collections)
    .orderBy(asc(collections.createdAt));
  return rows;
}

export async function createCollection(name: string, description?: string): Promise<string> {
  const id = newId();
  await db.insert(collections).values({ id, name: name.slice(0, 80), description: description ?? null });
  return id;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  await db.update(collections).set({ name: name.slice(0, 80) }).where(eq(collections.id, id));
}

export async function deleteCollection(id: string): Promise<void> {
  await db.delete(collections).where(eq(collections.id, id));
}

export async function addToCollection(collectionId: string, itemId: string): Promise<void> {
  const max = await db.execute(
    sql`select coalesce(max(position), -1) + 1 as next from collection_items where collection_id = ${collectionId}`,
  );
  const next = (max.rows[0] as { next: number }).next;
  await db.insert(collectionItems).values({ collectionId, itemId, position: next }).onConflictDoNothing();
}

export async function removeFromCollection(collectionId: string, itemId: string): Promise<void> {
  await db
    .delete(collectionItems)
    .where(sql`${collectionItems.collectionId} = ${collectionId} and ${collectionItems.itemId} = ${itemId}`);
}

export async function collectionExists(id: string): Promise<boolean> {
  const rows = await db.select({ id: collections.id }).from(collections).where(eq(collections.id, id)).limit(1);
  return rows.length > 0;
}
