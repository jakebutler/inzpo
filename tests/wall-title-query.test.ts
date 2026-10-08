import { existsSync, readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";
import { items } from "@/lib/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_FILTER } from "@/lib/filter";
import { kitDisplayName } from "@/lib/kit-name";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), readBriefJob: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { execute: mocks.execute } }));
vi.mock("@/lib/brief", () => ({ startBriefJob: vi.fn(), readBriefJob: mocks.readBriefJob }));
vi.mock("@/lib/auth/owner", async () => ({ ...await import("@/lib/auth/owner-ids"), assertItemOwned: vi.fn() }));
import { getWallItems } from "@/lib/items";

describe("Wall title data", () => {
  it("uses the existing items schema without introducing a migration", () => {
    expect(getTableColumns(items)).not.toHaveProperty("briefState");
    expect(existsSync("drizzle/0004_brief_state.sql")).toBe(false);
    expect(existsSync("drizzle/meta/0004_snapshot.json")).toBe(false);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries.map((entry: { tag: string }) => entry.tag)).not.toContain("0004_brief_state");
  });

  it("loads creation dates and real role colours in one query without brief jobs", async () => {
    const now = Date.now();
    mocks.execute.mockResolvedValue({ rows: [
      { id: "recent", title: null, createdAt: new Date(now), colorRows: [{ hex: "#3f5e92", role: "primary", origin: "sampled" }] },
      { id: "older", title: "IMG_6208", createdAt: new Date(now - 60_001), colorRows: [{ hex: "#a0adbb", role: "primary", origin: "sampled" }] },
    ] });
    const cards = await getWallItems("owner", EMPTY_FILTER);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql;
    expect(query).toContain('i.created_at as "createdAt"');
    expect(query).not.toContain("brief_state");
    expect(mocks.readBriefJob).not.toHaveBeenCalled();
    expect(query).toContain("from item_colors c where c.item_id = i.id");
    expect(cards.map((card) => kitDisplayName({ title: card.title, primaryHex: card.roles.primary, createdAt: card.createdAt }, now))).toEqual(["", "Gray"]);
    expect(cards[1].hexColors[0]).toBe("#a0adbb");
  });
});
