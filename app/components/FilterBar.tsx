"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activeFilterCount,
  EMPTY_FILTER,
  serializeFilter,
  SORT_CHOICES,
  type FilterState,
  type SortChoice,
  type Stance,
} from "@/lib/filter";

export interface FilterBarFacet {
  id: string;
  name: string;
  values: string[];
}

const KINDS: Array<{ id: string; label: string }> = [
  { id: "url", label: "URL" },
  { id: "screenshot", label: "Screenshot" },
  { id: "photo", label: "Photo" },
  { id: "palette", label: "Palette" },
  { id: "article", label: "Article" },
  { id: "video", label: "Video" },
];

const FAMILY_SWATCH: Record<string, string> = {
  red: "#e02020",
  orange: "#ff8800",
  yellow: "#ffee00",
  "cream/beige": "#f5f0d8",
  brown: "#7a4a2b",
  gold: "#d4af37",
  green: "#2e9e44",
  teal: "#20b2aa",
  blue: "#1e6fd9",
  purple: "#7a3ff2",
  pink: "#ff8ac2",
  black: "#111111",
  white: "#ffffff",
  gray: "#8a8a8a",
};

function cycle(stance: Stance | undefined): Stance | undefined {
  if (!stance) return "include";
  if (stance === "include") return "exclude";
  return undefined;
}

export function FilterBar({
  state,
  facets,
  families,
  freeTags,
  matchCount,
  savedSlot,
}: {
  state: FilterState;
  facets: FilterBarFacet[];
  families: string[];
  freeTags: string[];
  matchCount: number;
  savedSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qDraft, setQDraft] = useState(state.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef<number>(matchCount);
  countRef.current = matchCount;

  const [sheetCount, setSheetCount] = useState<number | null>(null);

  const activeCount = activeFilterCount(state);

  function apply(next: FilterState) {
    const f = serializeFilter(next);
    router.push(f === serializeFilter(EMPTY_FILTER) || activeFilterCount(next) === 0 ? `/?f=${f}` : `/?f=${f}`, {
      scroll: false,
    });
  }

  function pushState(next: FilterState) {
    apply(next);
  }

  function pushQ(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushState({ ...state, q: value });
    }, 350);
  }

  function setKind(kind: string) {
    const kinds = { ...state.kinds };
    const next = cycle(kinds[kind]);
    if (next) kinds[kind] = next;
    else delete kinds[kind];
    pushState({ ...state, kinds });
  }

  function setFacetValue(facetId: string, value: string) {
    const existing = state.facetValues.find((s) => s.facetId === facetId && s.value === value);
    const rest = state.facetValues.filter((s) => !(s.facetId === facetId && s.value === value));
    const stance = cycle(existing?.stance);
    const facetValues = stance ? [...rest, { facetId, value, stance }] : rest;
    pushState({ ...state, facetValues });
  }

  function setFreeTag(name: string) {
    const existing = state.freeTags.find((t) => t.name === name);
    const rest = state.freeTags.filter((t) => t.name !== name);
    const stance = cycle(existing?.stance);
    const freeTags = stance ? [...rest, { name, stance }] : rest;
    pushState({ ...state, freeTags });
  }

  function setColor(family: string) {
    const existing = state.colors.find((c) => c.family === family);
    const rest = state.colors.filter((c) => c.family !== family);
    const stance = cycle(existing?.stance);
    const colors = stance ? [...rest, { family, stance }] : rest;
    pushState({ ...state, colors });
  }

  // live match count while the sheet is open
  useEffect(() => {
    if (!sheetOpen) {
      setSheetCount(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/filter-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serializeFilter(state).replace(/^/, ""),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json()) as { count: number };
        setSheetCount(body.count);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, JSON.stringify(state)]);

  const stanceMark = (s?: Stance) => (s === "include" ? "✓" : s === "exclude" ? "≠" : "");

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (state.q.trim()) {
      list.push({ key: "q", label: `“${state.q.trim()}”`, onRemove: () => pushState({ ...state, q: "" }) });
    }
    for (const [kind, stance] of Object.entries(state.kinds)) {
      list.push({
        key: `kind:${kind}`,
        label: `${KINDS.find((k) => k.id === kind)?.label ?? kind} ${stanceMark(stance)}`,
        onRemove: () => {
          const kinds = { ...state.kinds };
          delete kinds[kind];
          pushState({ ...state, kinds });
        },
      });
    }
    for (const sel of state.facetValues) {
      const facet = facets.find((f) => f.id === sel.facetId);
      list.push({
        key: `fv:${sel.facetId}:${sel.value}`,
        label: `${sel.value} ${stanceMark(sel.stance)}`,
        onRemove: () =>
          pushState({ ...state, facetValues: state.facetValues.filter((s) => s !== sel) }),
      });
      void facet;
    }
    for (const tag of state.freeTags) {
      list.push({
        key: `ft:${tag.name}`,
        label: `${tag.name} ${stanceMark(tag.stance)}`,
        onRemove: () => pushState({ ...state, freeTags: state.freeTags.filter((t) => t !== tag) }),
      });
    }
    for (const c of state.colors) {
      list.push({
        key: `col:${c.family}`,
        label: `${c.family} ${stanceMark(c.stance)}`,
        onRemove: () => pushState({ ...state, colors: state.colors.filter((x) => x !== c) }),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, facets]);

  return (
    <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight mr-1">Inzpo</span>
          <input
            type="search"
            defaultValue={state.q}
            onChange={(e) => pushQ(e.target.value)}
            placeholder="Search…"
            aria-label="Text search"
            className="flex-1 min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm min-h-[36px] outline-none focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="relative rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm min-h-[36px] hover:border-neutral-500"
            aria-label="Filters"
          >
            Filters
            {activeCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-900">
                {activeCount}
              </span>
            ) : null}
          </button>
          <select
            value={state.sort}
            onChange={(e) => pushState({ ...state, sort: e.target.value as SortChoice })}
            aria-label="Sort"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm min-h-[36px] outline-none"
          >
            {SORT_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s === "newest" ? "Newest" : s === "oldest" ? "Oldest" : s === "title" ? "Title A–Z" : "Shuffle"}
              </option>
            ))}
          </select>
          {savedSlot}
        </div>

        {activeCount > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                onClick={chip.onRemove}
                className="rounded-full border border-neutral-600 bg-neutral-900 px-3 py-1 text-xs min-h-[28px] text-neutral-200 hover:border-neutral-400"
                title="Tap to remove"
              >
                {chip.label} ✕
              </button>
            ))}
            <button
              type="button"
              onClick={() => pushState({ ...EMPTY_FILTER, sort: state.sort })}
              className="rounded-full px-2 py-1 text-xs min-h-[28px] text-neutral-500 hover:text-neutral-300"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-xl rounded-t-2xl border border-neutral-700 bg-neutral-950 max-h-[82vh] overflow-y-auto p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky -top-4 -mx-4 -mt-4 mb-3 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
              <span className="text-sm font-medium">Filters</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 min-h-[36px]"
              >
                Done{sheetCount !== null ? ` — ${sheetCount} item${sheetCount === 1 ? "" : "s"} match` : ""}
              </button>
            </div>

            <div className="space-y-5">
              <section>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Kind</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {KINDS.map((k) => {
                    const s = state.kinds[k.id];
                    return (
                      <button
                        type="button"
                        key={k.id}
                        onClick={() => setKind(k.id)}
                        aria-pressed={!!s}
                        className={`rounded-full border px-3 py-1.5 text-sm min-h-[36px] ${
                          s === "include"
                            ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                            : s === "exclude"
                              ? "border-neutral-500 bg-transparent text-neutral-400 line-through"
                              : "border-neutral-700 bg-neutral-900 text-neutral-300"
                        }`}
                      >
                        {k.label} {stanceMark(s)}
                      </button>
                    );
                  })}
                </div>
              </section>

              {facets.map((facet) => (
                <section key={facet.id}>
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">{facet.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {facet.values.map((value) => {
                      const s = state.facetValues.find((x) => x.facetId === facet.id && x.value === value)?.stance;
                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setFacetValue(facet.id, value)}
                          aria-pressed={!!s}
                          className={`rounded-full border px-3 py-1.5 text-sm min-h-[36px] ${
                            s === "include"
                              ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                              : s === "exclude"
                                ? "border-neutral-500 bg-transparent text-neutral-400 line-through"
                                : "border-neutral-700 bg-neutral-900 text-neutral-300"
                          }`}
                        >
                          {value} {stanceMark(s)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {freeTags.length > 0 ? (
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Free tags</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {freeTags.map((tag) => {
                      const s = state.freeTags.find((t) => t.name === tag)?.stance;
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => setFreeTag(tag)}
                          aria-pressed={!!s}
                          className={`rounded-full border px-3 py-1.5 text-sm min-h-[36px] ${
                            s === "include"
                              ? "border-sky-300 bg-sky-300 text-neutral-900"
                              : s === "exclude"
                                ? "border-neutral-500 bg-transparent text-neutral-400 line-through"
                                : "border-neutral-700 bg-neutral-900 text-neutral-300"
                          }`}
                        >
                          {tag} {stanceMark(s)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Colors</h3>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {families.map((family) => {
                    const s = state.colors.find((c) => c.family === family)?.stance;
                    return (
                      <button
                        type="button"
                        key={family}
                        onClick={() => setColor(family)}
                        aria-pressed={!!s}
                        aria-label={`${family} ${s ?? ""}`}
                        title={`${family}${s ? " " + s : ""}`}
                        className={`h-9 w-9 rounded-full border-2 ${
                          s === "include" ? "border-neutral-100" : s === "exclude" ? "border-neutral-500 opacity-40" : "border-neutral-700"
                        }`}
                        style={{ backgroundColor: FAMILY_SWATCH[family] ?? "#666" }}
                      >
                        {s ? <span className="text-[10px] font-bold text-neutral-900 mix-blend-difference">{stanceMark(s)}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
