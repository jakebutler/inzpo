import type { ItemKind } from "@/lib/db/schema";

/**
 * Relevance model for the capture tray: which facets surface for a kind,
 * in order, and which deterministic tags the system auto-selects.
 * Everything else stays available under "More tags".
 */

export const RELEVANT_FACETS: Record<ItemKind, string[]> = {
  photo: ["Style", "Mood", "Complexity", "Usage"],
  screenshot: ["Style", "Mood", "Complexity", "Usage"],
  url: ["Usage", "Medium", "Format", "Style"],
  article: ["Usage", "Medium", "Mood", "Style"],
  video: ["Medium", "Format", "Mood", "Style"],
  palette: ["Style", "Complexity", "Mood"],
};

export const ALL_FACET_NAMES = ["Style", "Usage", "Medium", "Format", "Mood", "Complexity"];

export function relevantFacetsFor(kind: ItemKind): string[] {
  return RELEVANT_FACETS[kind] ?? ALL_FACET_NAMES;
}

export function moreFacetsFor(kind: ItemKind): string[] {
  const relevant = new Set(relevantFacetsFor(kind));
  return ALL_FACET_NAMES.filter((n) => !relevant.has(n));
}

/**
 * Deterministic auto-selections: only what detection actually knows.
 * Each rides the payload like a hand-picked tag (and shows an "auto" marker).
 */
export interface AutoTag {
  facet: string;
  value: string;
}

export function autoTagsFor(kind: ItemKind): AutoTag[] {
  switch (kind) {
    case "url":
      return [{ facet: "Medium", value: "web" }];
    case "article":
      return [{ facet: "Medium", value: "web" }];
    case "video":
      return [
        { facet: "Medium", value: "motion" },
        { facet: "Medium", value: "web" },
      ];
    default:
      return [];
  }
}
