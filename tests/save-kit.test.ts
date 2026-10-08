import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canSaveKit } from "@/lib/save-kit";

describe("canSaveKit", () => {
  it("blocks a second save tap", () => {
    expect(canSaveKit({ saved: false, pending: false })).toBe(true);
    expect(canSaveKit({ saved: true, pending: false })).toBe(false);
    expect(canSaveKit({ saved: false, pending: true })).toBe(false);
  });

  it("collection membership is unique so a second save cannot duplicate the kit", () => {
    const schema = readFileSync(path.join(process.cwd(), "lib/db/schema.ts"), "utf8");
    const collections = readFileSync(path.join(process.cwd(), "lib/collections.ts"), "utf8");
    expect(schema).toMatch(/primaryKey\(\{\s*columns:\s*\[t\.collectionId,\s*t\.itemId\]\s*\}\)/);
    expect(collections).toContain("onConflictDoNothing");
    expect(readFileSync(path.join(process.cwd(), "app/components/SaveBar.tsx"), "utf8")).toContain("canSaveKit");
  });
});
