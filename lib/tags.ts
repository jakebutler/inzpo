export interface TagSelection {
  facetValues: Array<{ facetId?: string; facet?: string; value: string }>;
  freeTags: string[];
}

export function parseTagSelection(raw: FormDataEntryValue | null): TagSelection {
  const empty: TagSelection = { facetValues: [], freeTags: [] };
  if (typeof raw !== "string" || raw.length === 0) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<TagSelection>;
    return {
      facetValues: Array.isArray(parsed.facetValues)
        ? parsed.facetValues
            .filter(
              (v) =>
                v &&
                typeof v.value === "string" &&
                v.value.trim().length > 0 &&
                (typeof v.facetId === "string" || typeof v.facet === "string"),
            )
            .map((v) => ({
              facetId: typeof v.facetId === "string" ? v.facetId : undefined,
              facet: typeof v.facet === "string" ? v.facet : undefined,
              value: v.value.trim().slice(0, 60),
            }))
        : [],
      freeTags: Array.isArray(parsed.freeTags)
        ? parsed.freeTags.filter((t) => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().slice(0, 60))
        : [],
    };
  } catch {
    return empty;
  }
}
