import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), assertOwned: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return { db: drizzle(mocks.query) };
});
vi.mock("@/lib/auth/owner", () => ({
  assertItemOwned: mocks.assertOwned,
  ownerClause: (column: Parameters<typeof eq>[0], ownerId: string) => eq(column, ownerId),
}));

import { getItemCollections } from "@/lib/item-collections";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ rows: [["latest", "Window studies"], ["older", "Architecture"]] });
});

describe("item collection lookup", () => {
  it("orders saved kit memberships by save time, with a deterministic legacy fallback", async () => {
    expect(await getItemCollections("owner", "kit", "recent")).toEqual([
      { id: "latest", name: "Window studies" }, { id: "older", name: "Architecture" },
    ]);
    expect(mocks.assertOwned).toHaveBeenCalledWith("owner", "kit");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(params).toEqual(["kit", "owner"]);
    expect(sql).toContain('order by "collections"."created_at" desc, "collections"."id" desc');
    expect(sql).toContain('"collections"."owner_id" =');
  });

  it("keeps collection lists alphabetical by default", async () => {
    await getItemCollections("owner", "kit");
    expect(mocks.query.mock.calls[0][0]).toContain('order by "collections"."name"');
  });
});

it("adds no schema migration for saved state", async () => {
  const { readdirSync } = await import("node:fs");
  expect(readdirSync("drizzle").filter((f) => f.startsWith("0004"))).toEqual([]);
});
