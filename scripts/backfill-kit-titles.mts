/**
 * Preview-only: persist generated names onto Untitled kits from their ready briefs.
 *
 *   BACKFILL_PREVIEW=1 npx tsx scripts/backfill-kit-titles.mts
 */
import { persistKitTitleFromBrief } from "../lib/kit-title.ts";
import { readBriefJob } from "../lib/brief.ts";
import { db } from "../lib/db/index.ts";
import { items } from "../lib/db/schema.ts";
import { isCameraFilename, UNTITLED_KIT } from "../lib/kit-name.ts";

function refuseProduction(): void {
  const env = (process.env.VERCEL_ENV ?? "").toLowerCase();
  const flag = process.env.BACKFILL_PREVIEW === "1";
  const url = process.env.DATABASE_URL ?? "";
  if (env === "production") {
    throw new Error("Refusing to backfill kit titles on production");
  }
  if (!flag) {
    throw new Error("Set BACKFILL_PREVIEW=1 to run this Preview-only backfill");
  }
  if (/prod/i.test(url) && !/preview/i.test(url)) {
    throw new Error("DATABASE_URL looks like production; aborting");
  }
}

async function main(): Promise<void> {
  refuseProduction();
  const rows = await db.select({ id: items.id, title: items.title, kind: items.kind }).from(items);
  const candidates = rows.filter((row) => {
    if (row.kind !== "photo" && row.kind !== "screenshot") return false;
    const title = row.title?.trim() ?? "";
    return !title || title === UNTITLED_KIT || /^untitled/i.test(title) || isCameraFilename(title);
  });
  let updated = 0;
  let skipped = 0;
  for (const row of candidates) {
    const job = await readBriefJob(row.id);
    if (!job || job.status !== "ready") {
      skipped += 1;
      continue;
    }
    const name = await persistKitTitleFromBrief(row.id, job);
    if (name && name !== row.title) {
      updated += 1;
      console.log(`${row.id} -> ${name}`);
    } else {
      skipped += 1;
    }
  }
  console.log(`backfill done updated=${updated} skipped=${skipped} scanned=${candidates.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
