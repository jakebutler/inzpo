export type Stance = "include" | "exclude";
export type SortChoice = "newest" | "oldest" | "title" | "shuffle";

export const SORT_CHOICES: SortChoice[] = ["newest", "oldest", "title", "shuffle"];

export interface FacetSelection {
  facetId: string;
  value: string;
  stance: Stance;
}

export interface FilterState {
  q: string;
  kinds: Record<string, Stance>;
  facetValues: FacetSelection[];
  freeTags: Array<{ name: string; stance: Stance }>;
  colors: Array<{ family: string; stance: Stance }>;
  sort: SortChoice;
}

export const EMPTY_FILTER: FilterState = {
  q: "",
  kinds: {},
  facetValues: [],
  freeTags: [],
  colors: [],
  sort: "newest",
};

const STANCES = new Set<Stance>(["include", "exclude"]);
const VALID_SORTS = new Set<string>(SORT_CHOICES);

export function normalizeFilterState(raw: unknown): FilterState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_FILTER };
  const r = raw as Partial<FilterState>;
  const stances = (v: unknown): v is Stance => typeof v === "string" && STANCES.has(v as Stance);
  return {
    q: typeof r.q === "string" ? r.q.slice(0, 200) : "",
    kinds:
      r.kinds && typeof r.kinds === "object"
        ? Object.fromEntries(
            Object.entries(r.kinds).filter(([, v]) => stances(v)).slice(0, 6),
          ) as FilterState["kinds"]
        : {},
    facetValues: Array.isArray(r.facetValues)
      ? r.facetValues
          .filter((s) => s && typeof s.facetId === "string" && typeof s.value === "string" && stances(s.stance))
          .slice(0, 100)
      : [],
    freeTags: Array.isArray(r.freeTags)
      ? r.freeTags.filter((s) => s && typeof s.name === "string" && stances(s.stance)).slice(0, 100)
      : [],
    colors: Array.isArray(r.colors)
      ? r.colors.filter((s) => s && typeof s.family === "string" && stances(s.stance)).slice(0, 20)
      : [],
    sort: typeof r.sort === "string" && VALID_SORTS.has(r.sort) ? (r.sort as SortChoice) : "newest",
  };
}

export function parseFilterParam(value: string | null | undefined): FilterState {
  if (!value) return { ...EMPTY_FILTER };
  try {
    return normalizeFilterState(JSON.parse(decodeURIComponent(value)));
  } catch {
    return { ...EMPTY_FILTER };
  }
}

export function serializeFilter(state: FilterState): string {
  const trimmed: FilterState = {
    ...state,
    q: state.q.trim(),
    facetValues: state.facetValues,
  };
  return encodeURIComponent(JSON.stringify(trimmed));
}

export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.q.trim()) n++;
  n += Object.keys(state.kinds).length;
  n += state.facetValues.length;
  n += state.freeTags.length;
  n += state.colors.length;
  return n;
}
