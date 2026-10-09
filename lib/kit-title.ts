import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { COLOR_ROLES, itemColors, items } from "@/lib/db/schema";
import { sampledColors } from "@/lib/derived-roles";
import type { NamedColor } from "@/lib/brief-copy";
import { generatedKitTitle, isCameraFilename, primaryKitTitle } from "@/lib/kit-name";

export type BriefTitleSource = {
  status: string;
  text: string | null;
  namedColors: NamedColor[];
  stub?: boolean;
  subject?: string | null;
};

export { generatedKitTitle };

/** Name once at initial brief completion, including a subjectless failure. */
export async function persistKitTitleFromBrief(itemId: string, job: BriefTitleSource): Promise<string | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (job.status !== "ready" && job.status !== "failed") return null;
  const rows = await db.select({ title: items.title }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!rows.length) return null;
  const current = rows[0]?.title ?? null;
  if (current?.trim() && !isCameraFilename(current)) return current.trim();
  const colors = await db.select({ hex: itemColors.hex, role: itemColors.role, origin: itemColors.origin,
    pinX: itemColors.pinX, pinY: itemColors.pinY }).from(itemColors)
    .where(eq(itemColors.itemId, itemId)).limit(12);
  const real = sampledColors(colors);
  const primary = COLOR_ROLES.map(role => real.find(color => color.role === role)?.hex).find(Boolean);
  if (!primary) return null;
  const name = primaryKitTitle(primary, { briefText: job.stub ? null : job.text, subject: job.stub ? null : job.subject });
  // Competing completions and explicit renames must not overwrite each other.
  const written = await db.update(items).set({ title: name, updatedAt: new Date() })
    .where(and(eq(items.id, itemId), current === null ? isNull(items.title) : eq(items.title, current)))
    .returning({ title: items.title });
  if (written.length) return written[0].title;
  const saved = await db.select({ title: items.title }).from(items).where(eq(items.id, itemId)).limit(1);
  return saved[0]?.title ?? null;
}

/** Rename an owned kit separately from its collection. */
export async function saveKitTitle(ownerId: string, itemId: string, title: string): Promise<void> {
  await db.update(items).set({ title, updatedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.ownerId, ownerId)));
}
