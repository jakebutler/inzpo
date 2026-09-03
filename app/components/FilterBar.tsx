"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
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
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCount = activeFilterCount(state);

  function pushState(next: FilterState) {
    router.push(`/?f=${serializeFilter(next)}`, { scroll: false });
  }

  function pushQ(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => pushState({ ...state, q: value }), 350);
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
    pushState({ ...state, facetValues: stance ? [...rest, { facetId, value, stance }] : rest });
  }

  function setFreeTag(name: string) {
    const existing = state.freeTags.find((t) => t.name === name);
    const rest = state.freeTags.filter((t) => t.name !== name);
    const stance = cycle(existing?.stance);
    pushState({ ...state, freeTags: stance ? [...rest, { name, stance }] : rest });
  }

  function setColor(family: string) {
    const existing = state.colors.find((c) => c.family === family);
    const rest = state.colors.filter((c) => c.family !== family);
    const stance = cycle(existing?.stance);
    pushState({ ...state, colors: stance ? [...rest, { family, stance }] : rest });
  }

  useEffect(() => {
    if (!sheetOpen) {
      setSheetCount(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/filter-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ f: serializeFilter(state) }),
      signal: controller.signal,
    })
      .then(async (res) => setSheetCount(((await res.json()) as { count: number }).count))
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, JSON.stringify(state)]);

  const StanceMark = ({ s }: { s?: Stance }) =>
    s === "include" ? <Check className="inline h-3.5 w-3.5" /> : s === "exclude" ? <Ban className="inline h-3.5 w-3.5" /> : null;

  const chips: Array<{ key: string; label: string; stance?: Stance; onRemove: () => void }> = useMemo(() => {
    const list: Array<{ key: string; label: string; stance?: Stance; onRemove: () => void }> = [];
    if (state.q.trim()) list.push({ key: "q", label: `“${state.q.trim()}”`, stance: undefined as Stance | undefined, onRemove: () => pushState({ ...state, q: "" }) });
    for (const [kind, stance] of Object.entries(state.kinds)) {
      list.push({
        key: `kind:${kind}`,
        label: KINDS.find((k) => k.id === kind)?.label ?? kind, stance,
        onRemove: () => {
          const kinds = { ...state.kinds };
          delete kinds[kind];
          pushState({ ...state, kinds });
        },
      });
    }
    for (const sel of state.facetValues) {
      list.push({
        key: `fv:${sel.facetId}:${sel.value}`,
        label: sel.value,
        stance: sel.stance,
        onRemove: () => pushState({ ...state, facetValues: state.facetValues.filter((s) => s !== sel) }),
      });
    }
    for (const tag of state.freeTags) {
      list.push({
        key: `ft:${tag.name}`,
        label: tag.name,
        stance: tag.stance,
        onRemove: () => pushState({ ...state, freeTags: state.freeTags.filter((t) => t !== tag) }),
      });
    }
    for (const c of state.colors) {
      list.push({
        key: `col:${c.family}`,
        label: c.family,
        stance: c.stance,
        onRemove: () => pushState({ ...state, colors: state.colors.filter((x) => x !== c) }),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, facets]);

  const stanceClass = (s?: Stance) =>
    s === "include"
      ? "bg-primary text-primary-foreground border-transparent"
      : s === "exclude"
        ? "border-muted-foreground/60 text-muted-foreground line-through"
        : "bg-transparent text-foreground";

  const chipButton = (active: boolean, excluded: boolean) =>
    `min-h-[36px] cursor-pointer rounded-full px-3 text-sm ${
      active
        ? excluded
          ? "border-muted-foreground/60 text-muted-foreground line-through"
          : ""
        : "bg-transparent text-foreground"
    }`;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="mr-1 text-lg font-semibold tracking-tight">Inzpo</span>
            <Input
              type="search"
              defaultValue={state.q}
              onChange={(e) => pushQ(e.target.value)}
              placeholder="Search…"
              aria-label="Text search"
              className="h-9 min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSheetOpen(true)}
              aria-label="Filters"
              className="relative h-9"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              ) : null}
            </Button>
            <Select value={state.sort} onValueChange={(v) => pushState({ ...state, sort: v as SortChoice })}>
              <SelectTrigger className="h-9 w-[110px] text-sm" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_CHOICES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "newest" ? "Newest" : s === "oldest" ? "Oldest" : s === "title" ? "Title A–Z" : "Shuffle"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savedSlot}
          </div>

          {activeCount > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <button
                type="button"
                key={chip.key}
                onClick={chip.onRemove}
                aria-label={`Remove filter: ${chip.label}`}
              >
                  <Badge variant="outline" className="min-h-[28px] gap-1 px-2.5 text-xs">
                    {chip.label} <StanceMark s={(chip as { stance?: Stance }).stance} /> <X className="h-3 w-3 opacity-60" />
                  </Badge>
                </button>
              ))}
              <button
                type="button"
                onClick={() => pushState({ ...EMPTY_FILTER, sort: state.sort })}
                className="min-h-[28px] rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle>Filters</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Tap once to include, again to exclude, again to clear. Chip rows above remove a filter directly.
            </p>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <section className="scroll-mt-24">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kind</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {KINDS.map((k) => {
                  const s = state.kinds[k.id];
                  return (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      aria-pressed={s === "include"}
                      aria-label={`${k.label}${s ? ` — ${s === "include" ? "included" : "excluded"}` : ""}`}
                    >
                      <Badge variant="outline" className={`min-h-[36px] px-3 text-sm ${chipButton(!!s, s === "exclude")}`}>
                        {k.label} <StanceMark s={s} />
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </section>

            {facets.map((facet) => (
              <section key={facet.id} className="scroll-mt-24">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{facet.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {facet.values.map((value) => {
                    const s = state.facetValues.find((x) => x.facetId === facet.id && x.value === value)?.stance;
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setFacetValue(facet.id, value)}
                        aria-pressed={s === "include"}
                        aria-label={`${value}${s ? ` — ${s === "include" ? "included" : "excluded"}` : ""}`}
                      >
                        <Badge variant="outline" className={`min-h-[36px] px-3 text-sm ${chipButton(!!s, s === "exclude")}`}>
                          {value} <StanceMark s={s} />
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {freeTags.length > 0 ? (
              <section className="scroll-mt-24">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Free tags</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {freeTags.map((tag) => {
                    const s = state.freeTags.find((t) => t.name === tag)?.stance;
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setFreeTag(tag)}
                        aria-pressed={s === "include"}
                        aria-label={`${tag}${s ? ` — ${s === "include" ? "included" : "excluded"}` : ""}`}
                      >
                        <Badge variant="outline" className={`min-h-[36px] px-3 text-sm ${chipButton(!!s, s === "exclude")}`}>
                          {tag} <StanceMark s={s} />
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="scroll-mt-24">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Colors</h3>
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
                        s === "include" ? "border-primary" : s === "exclude" ? "border-muted-foreground opacity-40" : "border-border"
                      }`}
                      style={{ backgroundColor: FAMILY_SWATCH[family] ?? "#666" }}
                    >
                      {s ? (
                      <span className="flex items-center justify-center text-neutral-900 mix-blend-difference">
                        {s === "include" ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </span>
                    ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <SheetFooter>
            <Button type="button" onClick={() => setSheetOpen(false)} className="w-full" size="lg">
              Done{sheetCount !== null ? ` — ${sheetCount} item${sheetCount === 1 ? "" : "s"} match` : ""}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function stanceMark(s?: Stance) {  return s === "include" ? "✓" : s === "exclude" ? "≠" : "";
}
