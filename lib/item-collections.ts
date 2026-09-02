import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, collectionItems } from "@/lib/db/schema";

export async function getItemCollections(itemId: string): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: collections.id, name: collections.name })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(eq(collectionItems.itemId, itemId))
    .orderBy(collections.name);
}

export async function listCollectionOptions(): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: collections.id, name: collections.name }).from(collections).orderBy(collections.name);
}
