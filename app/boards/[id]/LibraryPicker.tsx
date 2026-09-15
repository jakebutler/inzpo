"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EMPTY_FILTER, serializeFilter, type FilterState, type Stance } from "@/lib/filter";

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

const KIND_LABELS: Record<string, string> = {
  url: "URL",
  screenshot: "Screenshot",
  photo: "Photo",
  palette: "Palette",
  article: "Article",
  video: "Video",
};

export interface PickerRow {
  id: string;
  title: string | null;
  kind: string;
  thumb: string | null;
  aspect: number | null;
  colors: string[];
}

interface PickerResponse {
  items: PickerRow[];
  count: number;
}

function cycle(stance: Stance | undefined): Stance | undefined {
  if (!stance) return "include";
  if (stance === "include") return "exclude";
  return undefined;
}

export function LibraryPicker({
  open,
  onOpenChange,
  exclude,
  facets,
  families,
  freeTags,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exclude: string[];
  facets: Array<{ id: string; name: string; values: string[] }>;
  families: string[];
  freeTags: string[];
  onAdd: (rows: PickerRow[]) => void;
}) {
  const [state, setState] = useState<FilterState>({ ...EMPTY_FILTER });
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filterKey = serializeFilter(state);
  const excludeKey = useMemo(() => exclude.join(","), [exclude]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(false);
      fetch("/api/picker-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ f: filterKey, exclude: excludeKey ? excludeKey.split(",") : [] }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("picker request failed");
          return (await res.json()) as PickerResponse;
        })
        .then((d) => {
          setRows(d.items);
          setTotal(d.count);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") {
            setError(true);
            setLoading(false);
          }
        });
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterKey, excludeKey]);

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  function patch(next: FilterState) {
    setState(next);
  }

  function setKind(kind: string) {
    const kinds = { ...state.kinds };
    const next = cycle(kinds[kind]);
    if (next) kinds[kind] = next;
    else delete kinds[kind];
    patch({ ...state, kinds });
  }

  function setFacetValue(facetId: string, value: string) {
    const existing = state.facetValues.find((s) => s.facetId === facetId && s.value === value);
    const rest = state.facetValues.filter((s) => !(s.facetId === facetId && s.value === value));
    const stance = cycle(existing?.stance);
    patch({ ...state, facetValues: stance ? [...rest, { facetId, value, stance }] : rest });
  }

  function setFreeTag(name: string) {
    const existing = state.freeTags.find((t) => t.name === name);
    const rest = state.freeTags.filter((t) => t.name !== name);
    const stance = cycle(existing?.stance);
    patch({ ...state, freeTags: stance ? [...rest, { name, stance }] : rest });
  }

  function setColor(family: string) {
    const existing = state.colors.find((c) => c.family === family);
    const rest = state.colors.filter((c) => c.family !== family);
    const stance = cycle(existing?.stance);
    patch({ ...state, colors: stance ? [...rest, { family, stance }] : rest });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const StanceMark = ({ s }: { s?: Stance }) =>
    s === "include" ? <Check className="inline h-3.5 w-3.5" /> : s === "exclude" ? <Ban className="inline h-3.5 w-3.5" /> : null;

  const stanceClass = (s?: Stance) =>
    s === "include"
      ? "bg-primary text-primary-foreground border-transparent"
      : s === "exclude"
        ? "border-muted-foreground/60 text-muted-foreground line-through"
        : "bg-transparent text-foreground";

  const chip = (active: boolean, excluded: boolean) =>
    `min-h-[28px] cursor-pointer rounded-full px-2.5 text-xs ${
      active ? (excluded ? "border-muted-foreground/60 text-muted-foreground line-through" : "") : "bg-transparent text-foreground"
    }`;

  const activeCount =
    (state.q.trim() ? 1 : 0) + Object.keys(state.kinds).length + state.facetValues.length + state.freeTags.length + state.colors.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr_auto] gap-0 rounded-none border-0 p-0 sm:max-w-none">
        <div className="border-b border-border p-4">
          <DialogTitle>Add items</DialogTitle>
          <DialogDescription className="text-xs">
            Pick from your library — placed items are hidden. Tap a chip to include, again to exclude, again to clear.
          </DialogDescription>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="search"
              value={state.q}
              onChange={(e) => patch({ ...state, q: e.target.value })}
              placeholder="Search…"
              aria-label="Text search"
              className="h-8"
            />
            {activeCount > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => patch({ ...EMPTY_FILTER })}>
                Clear all
              </Button>
            ) : null}
          </div>

          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            <section>
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kind</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {KINDS.map((k) => {
                  const s = state.kinds[k.id];
                  return (
                    <button type="button" key={k.id} onClick={() => setKind(k.id)} aria-pressed={s === "include"}>
                      <Badge variant="outline" className={`${chip(!!s, s === "exclude")} ${stanceClass(s)}`}>
                        {k.label} <StanceMark s={s} />
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </section>

            {facets.map((facet) => (
              <section key={facet.id}>
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{facet.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {facet.values.map((value) => {
                    const s = state.facetValues.find((x) => x.facetId === facet.id && x.value === value)?.stance;
                    return (
                      <button type="button" key={value} onClick={() => setFacetValue(facet.id, value)} aria-pressed={s === "include"}>
                        <Badge variant="outline" className={`${chip(!!s, s === "exclude")} ${stanceClass(s)}`}>
                          {value} <StanceMark s={s} />
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {freeTags.length > 0 ? (
              <section>
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Free tags</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {freeTags.map((tag) => {
                    const s = state.freeTags.find((t) => t.name === tag)?.stance;
                    return (
                      <button type="button" key={tag} onClick={() => setFreeTag(tag)} aria-pressed={s === "include"}>
                        <Badge variant="outline" className={`${chip(!!s, s === "exclude")} ${stanceClass(s)}`}>
                          {tag} <StanceMark s={s} />
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section>
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Colors</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {families.map((family) => {
                  const s = state.colors.find((c) => c.family === family)?.stance;
                  return (
                    <button
                      type="button"
                      key={family}
                      onClick={() => setColor(family)}
                      aria-pressed={s === "include"}
                      aria-label={`${family}${s ? ` — ${s === "include" ? "included" : "excluded"}` : ""}`}
                      title={family}
                      className={`h-7 w-7 rounded-full border-2 ${
                        s === "include" ? "border-primary" : s === "exclude" ? "border-muted-foreground opacity-40" : "border-border"
                      }`}
                      style={{ backgroundColor: FAMILY_SWATCH[family] ?? "#666" }}
                    >
                      {s ? (
                        <span className="flex items-center justify-center text-neutral-900 mix-blend-difference">
                          {s === "include" ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-4" aria-busy={loading || undefined}>
          {error ? (
            <p className="py-12 text-center text-sm text-muted-foreground" role="status">
              Couldn't load items — check the connection and try again.
            </p>
          ) : rows.length === 0 && !loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground" role="status">
              {activeCount > 0 ? "Nothing matches these filters." : "The library is empty — capture something first."}
            </p>
          ) : (
            <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
              {rows.map((row) => {
                const on = selected.has(row.id);
                return (
                  <button
                    type="button"
                    key={row.id}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(row.id)}
                    className={`relative overflow-hidden rounded-xl border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      on ? "border-ring ring-2 ring-ring" : "border-border hover:border-neutral-500"
                    }`}
                  >
                    {row.thumb ? (
                      <img
                        src={`/media/${row.thumb}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={row.aspect ? { aspectRatio: String(row.aspect) } : undefined}
                        className="w-full bg-neutral-900 object-cover"
                      />
                    ) : (
                      <span className="flex h-24 items-center justify-center bg-neutral-900 px-2 text-center text-xs text-neutral-500">
                        {row.title ?? "Untitled"}
                      </span>
                    )}
                    <span className="block bg-card px-2 py-1.5">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {KIND_LABELS[row.kind] ?? row.kind}
                      </span>
                      <span className="block truncate text-xs">{row.title ?? "Untitled"}</span>
                      {row.colors.length > 0 ? (
                        <span className="mt-1 flex gap-1">
                          {row.colors.slice(0, 6).map((hex, i) => (
                            <span key={`${row.id}-${i}`} className="inline-block h-2.5 w-2.5 rounded-full border border-neutral-700" style={{ backgroundColor: hex }} />
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
                        on ? "bg-neutral-100 text-neutral-900" : "border border-neutral-400 bg-black/40 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border p-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {loading
              ? "Loading…"
              : error
                ? "Load failed."
                : `${rows.length} shown · ${total ?? 0} match${total === 1 ? "" : "es"}`}
          </p>
          <Button
            type="button"
            className="ml-auto"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => onAdd(rows.filter((r) => selected.has(r.id)))}
          >
            Add {selected.size > 0 ? selected.size : ""} item{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
