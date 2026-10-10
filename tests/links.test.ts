import { describe, expect, it } from "vitest";
import { LINKS_UNSUPPORTED_ERROR, LINKS_UNSUPPORTED_MESSAGE, isLinksUnsupportedRequest } from "@/lib/links";
import { HIDDEN_CAPTURE_KINDS, isHiddenCaptureKind, isWallVisibleKind, WALL_VISIBLE_KINDS } from "@/lib/kinds";

describe("links are not supported", () => {
  it("uses the decided copy", () => {
    expect(LINKS_UNSUPPORTED_MESSAGE).toBe("Links aren't supported yet.");
    expect(LINKS_UNSUPPORTED_ERROR).toBe("links-not-supported");
  });

  it("treats a pasted URL or the error flag as unsupported", () => {
    expect(isLinksUnsupportedRequest({ error: LINKS_UNSUPPORTED_ERROR })).toBe(true);
    expect(isLinksUnsupportedRequest({ url: "https://example.com" })).toBe(true);
    expect(isLinksUnsupportedRequest({})).toBe(false);
  });
});

describe("hidden kinds stay in the model, off the Wall", () => {
  it("hides URL, article, and video capture", () => {
    expect([...HIDDEN_CAPTURE_KINDS]).toEqual(["url", "article", "video"]);
    expect(isHiddenCaptureKind("url")).toBe(true);
    expect(isHiddenCaptureKind("article")).toBe(true);
    expect(isHiddenCaptureKind("video")).toBe(true);
    expect(isHiddenCaptureKind("photo")).toBe(false);
  });

  it("keeps photos, screenshots, and palettes on the Wall", () => {
    expect([...WALL_VISIBLE_KINDS]).toEqual(["screenshot", "photo", "palette"]);
    expect(isWallVisibleKind("photo")).toBe(true);
    expect(isWallVisibleKind("screenshot")).toBe(true);
    expect(isWallVisibleKind("palette")).toBe(true);
    expect(isWallVisibleKind("url")).toBe(false);
    expect(isWallVisibleKind("article")).toBe(false);
    expect(isWallVisibleKind("video")).toBe(false);
  });
});
