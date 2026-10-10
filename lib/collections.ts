import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems, collections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { assertCollectionOwned, assertItemOwned, ownerClause } from "@/lib/auth/owner";

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  count: number;
}

export async function listCollections(ownerId: string): Promise<CollectionSummary[]> {
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      count: sql<number>`(select count(*)::int from collection_items ci where ci.collection_id = ${collections.id})`,
    })
    .from(collections)
    .where(ownerClause(collections.ownerId, ownerId))
    .orderBy(asc(collections.createdAt));
  return rows;
}

export async function createCollection(ownerId: string, name: string, description?: string): Promise<string> {
  const id = newId();
  await db.insert(collections).values({ id, ownerId, name: name.slice(0, 80), description: description ?? null });
  return id;
}

export async function renameCollection(ownerId: string, id: string, name: string): Promise<void> {
  await assertCollectionOwned(ownerId, id);
  await db
    .update(collections)
    .set({ name: name.slice(0, 80) })
    .where(and(eq(collections.id, id), ownerClause(collections.ownerId, ownerId)));
}

export async function deleteCollection(ownerId: string, id: string): Promise<void> {
  await assertCollectionOwned(ownerId, id);
  await db.delete(collections).where(and(eq(collections.id, id), ownerClause(collections.ownerId, ownerId)));
}

export async function addToCollection(ownerId: string, collectionId: string, itemId: string): Promise<void> {
  await assertCollectionOwned(ownerId, collectionId);
  await assertItemOwned(ownerId, itemId);
  const max = await db.execute(
    sql`select coalesce(max(position), -1) + 1 as next from collection_items where collection_id = ${collectionId}`,
  );
  const next = (max.rows[0] as { next: number }).next;
  await db.insert(collectionItems).values({ collectionId, itemId, position: next }).onConflictDoNothing();
}

export async function removeFromCollection(ownerId: string, collectionId: string, itemId: string): Promise<void> {
  await assertCollectionOwned(ownerId, collectionId);
  await db
    .delete(collectionItems)
    .where(sql`${collectionItems.collectionId} = ${collectionId} and ${collectionItems.itemId} = ${itemId}`);
}

export async function collectionExists(ownerId: string, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, id), ownerClause(collections.ownerId, ownerId)))
    .limit(1);
  return rows.length > 0;
}
