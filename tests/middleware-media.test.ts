import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("clerk middleware matcher", () => {
  it("covers /media/ next to the static-file skip and api/trpc", () => {
    const mw = readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    expect(mw).toContain('"/media/(.*)"');
    expect(mw).toContain('"/(api|trpc)(.*)"');
    expect(mw).toMatch(/jpe\?g/);
    expect(mw).toMatch(/webp/);
    expect(mw).toMatch(/png/);
    const matcherBlock = mw.slice(mw.indexOf("matcher:"));
    expect(matcherBlock).toMatch(/\/media\/\(\.\*\)/);
    expect(matcherBlock.indexOf('"/media/(.*)"')).toBeGreaterThan(matcherBlock.indexOf("webp"));
  });
});
