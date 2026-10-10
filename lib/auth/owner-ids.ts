import { eq, inArray, sql, type Column, type SQL } from "drizzle-orm";

/** Rows created before per-user auth. Claimed by Jake on first matching sign-in. */
export const LEGACY_OWNER_ID = "legacy-jake";

/** Owner id used by scripts/ and tests/*.mts so they never write into a real user's library. */
export const TEST_OWNER_ID = "e2e-test";

export function ownerIdsFor(userId: string): string[] {
  const jake = process.env.JAKE_OWNER_ID;
  if (jake && userId === jake) return [userId, LEGACY_OWNER_ID];
  return [userId];
}

export function ownerClause(column: Column, ownerId: string) {
  const ids = ownerIdsFor(ownerId);
  return ids.length === 1 ? eq(column, ids[0]!) : inArray(column, ids);
}

export function ownerSql(columnSql: SQL, ownerId: string): SQL {
  const ids = ownerIdsFor(ownerId);
  if (ids.length === 1) return sql`${columnSql} = ${ids[0]!}`;
  return sql`${columnSql} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}
