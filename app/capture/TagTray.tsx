"use client";

import { useMemo, useState } from "react";

export interface TrayFacet {
  id: string;
  name: string;
  values: string[];
}

export function TagTray({ facets }: { facets: TrayFacet[] }) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [freeTags, setFreeTags] = useState<Set<string>>(new Set());

  const [facetDraft, setFacetDraft] = useState<Record<string, string>>({});
  const [freeDraft, setFreeDraft] = useState("");

  function toggleFacetValue(facetId: string, value: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[facetId] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[facetId] = set;
      return next;
    });
  }

  function createFacetValue(facetId: string) {
    const value = (facetDraft[facetId] ?? "").trim();
    if (!value) return;
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[facetId] ?? []);
      set.add(value);
      next[facetId] = set;
      return next;
    });
    setFacetDraft((prev) => ({ ...prev, [facetId]: "" }));
  }

  function addFreeTag() {
    const name = freeDraft.trim();
    if (!name) return;
    setFreeTags((prev) => new Set(prev).add(name));
    setFreeDraft("");
  }

  const payload = useMemo(
    () =>
      JSON.stringify({
        facetValues: Object.entries(selected).flatMap(([facetId, values]) =>
          [...values].map((value) => ({ facetId, value })),
        ),
        freeTags: [...freeTags],
      }),
    [selected, freeTags],
  );

  const totalSelected = Object.values(selected).reduce((n, s) => n + s.size, 0) + freeTags.size;

  return (
    <div>
      <input type="hidden" name="tags" value={payload} />
      <div className="space-y-4">
        {facets.map((facet) => {
          const extras = (selected[facet.id] ?? new Set());
          const known = new Set(facet.values);
          const custom = [...extras].filter((v) => !known.has(v));
          return (
            <fieldset key={facet.id}>
              <legend className="text-xs uppercase tracking-wide text-neutral-500">{facet.name}</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {facet.values.map((value) => {
                  const on = extras.has(value);
                  return (
                    <button
                      type="button"
                      key={value}
                      onClick={() => toggleFacetValue(facet.id, value)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-sm min-h-[36px] ${
                        on
                          ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                          : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
                {custom.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => toggleFacetValue(facet.id, value)}
                    aria-pressed={true}
                    className="rounded-full border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 min-h-[36px]"
                  >
                    {value} ✕
                  </button>
                ))}
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    value={facetDraft[facet.id] ?? ""}
                    onChange={(e) => setFacetDraft((prev) => ({ ...prev, [facet.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        createFacetValue(facet.id);
                      }
                    }}
                    placeholder="＋ new"
                    aria-label={`New ${facet.name} value`}
                    className="w-24 rounded-full border border-dashed border-neutral-700 bg-transparent px-3 py-1.5 text-sm min-h-[36px] outline-none focus:border-neutral-500"
                  />
                </span>
              </div>
            </fieldset>
          );
        })}

        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-neutral-500">Free tags</legend>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {[...freeTags].map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => setFreeTags((prev) => new Set([...prev].filter((t) => t !== tag)))}
                className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300 min-h-[36px]"
              >
                {tag} ✕
              </button>
            ))}
            <input
              type="text"
              value={freeDraft}
              onChange={(e) => setFreeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addFreeTag();
                }
              }}
              onBlur={addFreeTag}
              placeholder="＋ free tag"
              aria-label="New free tag"
              className="w-28 rounded-full border border-dashed border-neutral-700 bg-transparent px-3 py-1.5 text-sm min-h-[36px] outline-none focus:border-neutral-500"
            />
          </div>
        </fieldset>
      </div>
      <p className="mt-3 text-xs text-neutral-500" aria-live="polite">
        {totalSelected === 0 ? "Nothing tagged yet — zero-tag capture is fine." : `${totalSelected} selected`}
      </p>
    </div>
  );
}
