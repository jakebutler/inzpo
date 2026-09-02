import { describe, expect, it } from "vitest";
import { originalKey, variantKey, articleKey, itemPrefix, MEDIA_VARIANTS } from "@/lib/r2";
import { newId } from "@/lib/ids";

describe("media key layout", () => {
  it("uses items/{ulid}/ layout per the spec", () => {
    const id = newId();
    expect(itemPrefix(id)).toBe(`items/${id}/`);
    expect(originalKey(id, "jpg")).toBe(`items/${id}/original.jpg`);
    expect(articleKey(id)).toBe(`items/${id}/article.html`);
    for (const v of MEDIA_VARIANTS) {
      expect(variantKey(id, v)).toBe(`items/${id}/${v}.webp`);
    }
  });

  it("generates chronological ULIDs", () => {
    const a = newId();
    const b = newId();
    expect(a < b).toBe(true);
  });
});
