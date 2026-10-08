import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { COLOR_ROLES, itemColors, items } from "@/lib/db/schema";
import type { NamedColor } from "@/lib/brief-copy";
import { isHexColor } from "@/lib/colors";
import { sampledColors } from "@/lib/derived-roles";
import { fallbackKitName, generatedKitTitle } from "@/lib/kit-name";

export type BriefTitleSource = {
  status: string;
  text: string | null;
  subject?: string | null;
  namedColors: NamedColor[];
  stub?: boolean;
};

export { generatedKitTitle };

function shouldKeepExistingTitle(title: string | null | undefined): boolean {
  const current = title?.trim() ?? "";
  if (!current) return false;
  return generatedKitTitle({ title: current }) === current;
}

/** Completed briefs always leave a name; colour-only fallbacks can be replaced on retry. */
export async function persistKitTitleFromBrief(itemId: string, job: BriefTitleSource): Promise<string | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (job.status !== "ready" && job.status !== "failed") return null;
  const rows = await db.select({ title: items.title }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!rows.length) return null;
  const current = rows[0]?.title ?? null;
  const colors = sampledColors(await db.select({
    hex: itemColors.hex, role: itemColors.role, origin: itemColors.origin,
    pinX: itemColors.pinX, pinY: itemColors.pinY,
  }).from(itemColors).where(eq(itemColors.itemId, itemId)));
  const primaryHex = COLOR_ROLES.map((role) => colors.find((color) => color.role === role && isHexColor(color.hex))?.hex)
    .find(Boolean);
  const fallback = fallbackKitName(primaryHex);
  if (shouldKeepExistingTitle(current) && current?.trim() !== fallback) return current!.trim();
  const name = job.status === "ready" && !job.stub
    ? generatedKitTitle({ briefText: job.text, subject: job.subject, primaryHex, namedColors: job.namedColors }) ?? fallback
    : fallback;
  if (current?.trim() === name) return name;
  // A user may edit the title while the brief is finishing.
  await db.update(items).set({ title: name, updatedAt: new Date() }).where(and(
    eq(items.id, itemId),
    sql`${items.title} is not distinct from ${current}`,
  ));
  return name;
}
