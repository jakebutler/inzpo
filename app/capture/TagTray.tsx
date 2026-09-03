"use client";

import { useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AutoTag } from "@/lib/relevance";

gsap.registerPlugin(useGSAP);

export interface TrayFacet {
  id: string;
  name: string;
  values: string[];
}

export interface TrayInitial {
  facetValues?: Record<string, string[]>;
  freeTags?: string[];
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TagTray({
  facets,
  relevantNames,
  autoTags = [],
  initial,
}: {
  facets: TrayFacet[];
  relevantNames: string[];
  autoTags?: AutoTag[];
  initial?: TrayInitial;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const autoKeys = useMemo(
    () => new Set(autoTags.map((t) => `${t.facet.toLowerCase()}:${t.value.toLowerCase()}`)),
    [autoTags],
  );

  const [selected, setSelected] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    if (initial?.facetValues) {
      for (const [facetId, values] of Object.entries(initial.facetValues)) init[facetId] = new Set(values);
    }
    for (const t of autoTags) {
      const facet = facets.find((f) => f.name.toLowerCase() === t.facet.toLowerCase());
      if (!facet) continue;
      init[facet.id] = new Set(init[facet.id] ?? []).add(t.value);
    }
    return init;
  });
  const [freeTags, setFreeTags] = useState<Set<string>>(new Set(initial?.freeTags ?? []));
  const [showMore, setShowMore] = useState(false);

  const [facetDraft, setFacetDraft] = useState<Record<string, string>>({});
  const [freeDraft, setFreeDraft] = useState("");

  // The authored moment: relevant facets cascade in, auto-selected chips pop last.
  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set("[data-tray-group]", { opacity: 1 });
        gsap.set("[data-tray-chip]", { opacity: 1, scale: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-tray-group]", { opacity: 0, y: 12, duration: 0.28, stagger: 0.06 }).from(
        "[data-auto-chip]",
        { opacity: 0, scale: 0.6, duration: 0.32, ease: "back.out(2.2)", stagger: 0.09 },
        "-=0.15",
      );
    },
    { scope, dependencies: [] },
  );

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

  function createFacetValue(facetId: string, value: string) {
    const clean = value.trim();
    if (!clean) return;
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[facetId] ?? []);
      set.add(clean);
      next[facetId] = set;
      return next;
    });
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

  const relevant = facets.filter((f) => relevantNames.includes(f.name));
  const more = facets.filter((f) => !relevantNames.includes(f.name));

  function facetSection(facet: TrayFacet) {
    const extras = selected[facet.id] ?? new Set<string>();
    const known = new Set(facet.values);
    const custom = [...extras].filter((v) => !known.has(v));
    const autoForFacet = autoTags.filter((t) => t.facet.toLowerCase() === facet.name.toLowerCase());
    return (
      <fieldset key={facet.id} data-tray-group>
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{facet.name}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {facet.values.map((value) => {
            const on = extras.has(value);
            const isAuto = autoKeys.has(`${facet.name.toLowerCase()}:${value.toLowerCase()}`) && on;
            return (
              <button type="button" key={value} onClick={() => toggleFacetValue(facet.id, value)} aria-pressed={on}>
                <Badge
                  data-auto-chip={isAuto ? "" : undefined}
                  variant={on ? "default" : "outline"}
                  className={`min-h-[34px] gap-1 px-3 text-sm ${isAuto ? "ring-1 ring-primary/40" : ""}`}
                >
                  {value}
                  {isAuto ? (
                    <span className="rounded-full bg-primary/15 px-1 text-[9px] font-semibold uppercase tracking-wide">
                      auto
                    </span>
                  ) : null}
                </Badge>
              </button>
            );
          })}
          {custom.map((value) => (
            <button type="button" key={value} onClick={() => toggleFacetValue(facet.id, value)} aria-pressed>
              <Badge className="min-h-[34px] gap-1 px-3 text-sm">
                {value}
                <X className="h-3 w-3" />
              </Badge>
            </button>
          ))}
          <Input
            type="text"
            value={facetDraft[facet.id] ?? ""}
            onChange={(e) => setFacetDraft((prev) => ({ ...prev, [facet.id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                createFacetValue(facet.id, facetDraft[facet.id] ?? "");
              }
            }}
            placeholder="new"
            aria-label={`New ${facet.name} value`}
            className="h-[34px] w-24 rounded-full text-sm"
          />
        </div>
        {autoForFacet.length > 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            auto-selected: {autoForFacet.map((t) => t.value).join(", ")} — tap to remove
          </p>
        ) : null}
      </fieldset>
    );
  }

  return (
    <div ref={scope}>
      <input type="hidden" name="tags" value={payload} />
      <div className="space-y-4">
        {relevant.map((facet) => facetSection(facet))}

        {showMore ? more.map((facet) => facetSection(facet)) : null}

        {more.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showMore ? "fewer tag categories" : `${more.length} more tag categories`}
          </button>
        ) : null}

        <fieldset data-tray-group>
          <legend className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Free tags</legend>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {[...freeTags].map((tag) => (
              <button type="button" key={tag} onClick={() => setFreeTags((prev) => new Set([...prev].filter((t) => t !== tag)))}>
                <Badge variant="secondary" className="min-h-[34px] gap-1 px-3 text-sm">
                  {tag}
                  <X className="h-3 w-3" />
                </Badge>
              </button>
            ))}
            <Input
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
              placeholder="free tag"
              aria-label="New free tag"
              className="h-[34px] w-28 rounded-full text-sm"
            />
          </div>
        </fieldset>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {totalSelected === 0 ? "Skipping tags is fine — save now, tag later." : `${totalSelected} selected`}
      </p>
    </div>
  );
}
