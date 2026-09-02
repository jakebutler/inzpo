import { describe, expect, it } from "vitest";
import { FACET_SEEDS } from "@/lib/ontology-seeds";
import { parseTagSelection } from "@/lib/tags";

describe("facet seeds", () => {
  it("matches the spec's six fixed facets in order", () => {
    expect(FACET_SEEDS.map((f) => f.name)).toEqual(["Style", "Usage", "Medium", "Format", "Mood", "Complexity"]);
  });

  it("carries the full seed vocabularies", () => {
    const style = FACET_SEEDS.find((f) => f.name === "Style")!;
    expect(style.values).toContain("minimal");
    const complexity = FACET_SEEDS.find((f) => f.name === "Complexity")!;
    expect(complexity.values).toEqual(["sparse", "airy", "balanced", "rich", "dense"]);
    const mood = FACET_SEEDS.find((f) => f.name === "Mood")!;
    expect(mood.values).toHaveLength(6);
  });
});

describe("parseTagSelection", () => {
  it("parses valid selections", () => {
    const fd = new FormData();
    fd.set("tags", JSON.stringify({ facetValues: [{ facetId: "f1", value: "minimal" }], freeTags: ["inspo"] }));
    expect(parseTagSelection(fd.get("tags"))).toEqual({
      facetValues: [{ facetId: "f1", value: "minimal" }],
      freeTags: ["inspo"],
    });
  });

  it("drops empty and malformed entries", () => {
    const fd = new FormData();
    fd.set("tags", JSON.stringify({ facetValues: [{ facetId: "f1", value: "   " }, { facetId: "f1" }], freeTags: ["", 42] }));
    expect(parseTagSelection(fd.get("tags"))).toEqual({ facetValues: [], freeTags: [] });
  });

  it("survives garbage", () => {
    const fd = new FormData();
    fd.set("tags", "not json at all");
    expect(parseTagSelection(fd.get("tags"))).toEqual({ facetValues: [], freeTags: [] });
    expect(parseTagSelection(null)).toEqual({ facetValues: [], freeTags: [] });
  });
});
