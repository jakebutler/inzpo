import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import type { NamedColor } from "@/lib/brief-copy";
import { generatedKitTitle, kitDisplayName } from "@/lib/kit-name";

export type BriefTitleSource = {
  status: string;
  text: string | null;
  namedColors: NamedColor[];
  stub?: boolean;
};

export { generatedKitTitle };

function shouldKeepExistingTitle(title: string | null | undefined): boolean {
  const current = title?.trim() ?? "";
  if (!current) return false;
  return kitDisplayName({ title: current, pending: false }) === current;
}

/** Write the generated kit name onto items.title when the brief is ready. */
export async function persistKitTitleFromBrief(itemId: string, job: BriefTitleSource): Promise<string | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (job.status !== "ready" || job.stub) return null;
  const name = generatedKitTitle({ briefText: job.text, namedColors: job.namedColors });
  if (!name) return null;
  const rows = await db.select({ title: items.title }).from(items).where(eq(items.id, itemId)).limit(1);
  const current = rows[0]?.title ?? null;
  if (shouldKeepExistingTitle(current)) return current!.trim();
  if (current?.trim() === name) return name;
  await db.update(items).set({ title: name, updatedAt: new Date() }).where(eq(items.id, itemId));
  return name;
}
