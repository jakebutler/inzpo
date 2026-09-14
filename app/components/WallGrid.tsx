"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Square, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { activeFilterCount, serializeFilter, type FilterState } from "@/lib/filter";
import { bulkAssignTagsAction, bulkCollectionAction, bulkDeleteAction, bulkRemoveTagsAction } from "@/app/actions/bulk";

export interface WallCard {
  id: string;
  kind: string;
  title: string | null;
  displayKey: string | null;
  aspect: number | null;
  hexColors: string[];
  facetTags: Array<{ facet: string; value: string }>;
  freeTags: string[];
  sourceUrl: string | null;
}

const KIND_LABELS: Record<string, string> = {
  url: "URL",
  screenshot: "Screenshot",
  photo: "Photo",
  palette: "Palette",
  article: "Article",
  video: "Video",
};

export function WallGrid({
  items,
  state,
  totalCount,
  collections,
  facetOptions,
  collectionId,
}: {
  items: WallCard[];
  state: FilterState;
  totalCount: number;
  collections: Array<{ id: string; name: string }>;
  facetOptions: Array<{ id: string; name: string }>;
  collectionId: string | null;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [colCount, setColCount] = useState(2);
  const [bulkFacetId, setBulkFacetId] = useState("");
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(key: string, action: (fd: FormData) => Promise<void>, fd: FormData, success: string, after?: () => void) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        await action(fd);
        toast.success(success);
        after?.();
      } catch {
        toast.error("That didn't go through — the Items are unchanged.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  useEffect(() => {
    const queries: Array<[MediaQueryList, number]> = [
      [window.matchMedia("(min-width: 1024px)"), 4],
      [window.matchMedia("(min-width: 768px)"), 3],
    ];
    const update = () => setColCount(queries.find(([q]) => q.matches)?.[1] ?? 2);
    update();
    queries.forEach(([q]) => q.addEventListener("change", update));
    return () => queries.forEach(([q]) => q.removeEventListener("change", update));
  }, []);

  const f = serializeFilter(state);
  const selectedCount = allSelected ? totalCount : selected.size;

  function toggle(id: string) {
    if (allSelected) {
      setAllSelected(false);
      setSelected(new Set(items.filter((i) => i.id !== id).map((i) => i.id)));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startLongPress(id: string) {
    longFired.current = false;
    longPress.current = setTimeout(() => {
      longFired.current = true;
      setSelectMode(true);
      setSelected((prev) => new Set(prev).add(id));
    }, 450);
  }
  function cancelLongPress() {
    if (longPress.current) clearTimeout(longPress.current);
  }

  function hiddenTarget(fd: FormData) {
    if (allSelected) {
      fd.set("all", "1");
      fd.set("f", f);
      if (collectionId) fd.set("c", collectionId);
    } else {
      for (const id of selected) fd.append("ids", id);
    }
  }

  function withConfirm(message: string, run: () => void) {
    if (window.confirm(message)) run();
  }

  function exit() {
    setSelectMode(false);
    setSelected(new Set());
    setAllSelected(false);
    setConfirmingDelete(false);
  }

  if (selectMode) {
    return (
      <div>
        <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950 p-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <button type="button" onClick={exit} className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm min-h-[36px]">
              <X className="h-4 w-4" aria-hidden /> Exit selection
            </button>
            <button
              type="button"
              onClick={() => {
                setAllSelected(true);
                setSelected(new Set());
              }}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm min-h-[36px]"
            >
              Select all ({totalCount})
            </button>
            <span className="ml-auto text-sm text-neutral-300" aria-live="polite">
              {allSelected ? `All ${totalCount} items` : `${selected.size} selected`}
            </span>
          </div>

          {selectedCount > 0 ? (
            <fieldset disabled={pending} aria-busy={pending || undefined} className="mx-auto mt-2 max-w-6xl space-y-2 disabled:opacity-60">
              <div className="flex flex-wrap items-center gap-2">
                <form
                  action={bulkAssignTagsAction}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    if (!String(fd.get("facetValue") ?? "").trim() && !String(fd.get("freeTagName") ?? "").trim()) {
                      toast.error("Type a facet value or a free tag first.");
                      return;
                    }
                    hiddenTarget(fd);
                    if (bulkFacetId) fd.set("facetId", bulkFacetId);
                    run("assign", bulkAssignTagsAction, fd, `Tags assigned to ${selectedCount} Item${selectedCount === 1 ? "" : "s"}.`);
                  }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <Select value={bulkFacetId} onValueChange={setBulkFacetId}>
                    <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Facet">
                      <SelectValue placeholder="Facet" />
                    </SelectTrigger>
                    <SelectContent>
                      {facetOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="text" name="facetValue" placeholder="facet value" aria-label="Facet value" className="h-8 w-28 rounded text-xs" />
                  <Input type="text" name="freeTagName" placeholder="free tag" aria-label="Free tag" className="h-8 w-24 rounded text-xs" />
                  <Button type="submit" variant="outline" size="sm" className="h-8">
                    {pendingKey === "assign" ? "Assigning…" : "Assign tags"}
                  </Button>
                </form>
                <form
                  action={bulkRemoveTagsAction}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    if (!String(fd.get("facetValue") ?? "").trim() && !String(fd.get("freeTagName") ?? "").trim()) {
                      toast.error("Type a facet value or a free tag first.");
                      return;
                    }
                    hiddenTarget(fd);
                    if (bulkFacetId) fd.set("facetId", bulkFacetId);
                    run("remove", bulkRemoveTagsAction, fd, `Tags removed from ${selectedCount} Item${selectedCount === 1 ? "" : "s"}.`);
                  }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <Select value={bulkFacetId} onValueChange={setBulkFacetId}>
                    <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Facet to remove">
                      <SelectValue placeholder="Facet" />
                    </SelectTrigger>
                    <SelectContent>
                      {facetOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="text" name="facetValue" placeholder="facet value" aria-label="Facet value to remove" className="h-8 w-28 rounded text-xs" />
                  <Input type="text" name="freeTagName" placeholder="free tag" aria-label="Free tag to remove" className="h-8 w-24 rounded text-xs" />
                  <Button type="submit" variant="outline" size="sm" className="h-8">
                    {pendingKey === "remove" ? "Removing…" : "Remove tags"}
                  </Button>
                </form>

                <form
                  action={bulkCollectionAction}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const op = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-op") ?? "add";
                    if (op === "add" && !bulkCollectionId && !String(fd.get("newName") ?? "").trim()) {
                      toast.error("Pick a Collection or name a new one first.");
                      return;
                    }
                    if (op === "remove" && !bulkCollectionId) {
                      toast.error("Pick a Collection first.");
                      return;
                    }
                    hiddenTarget(fd);
                    fd.set("op", op);
                    run(
                      op === "remove" ? "col-remove" : "col-add",
                      bulkCollectionAction,
                      fd,
                      op === "remove" ? "Items removed from the Collection." : "Items added to the Collection.",
                    );
                  }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <Select value={bulkCollectionId} onValueChange={setBulkCollectionId}>
                    <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Collection">
                      <SelectValue placeholder="Collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="op" value="add" />
                  <input type="text" name="newName" placeholder="or new collection" aria-label="New collection name" className="w-36 rounded border border-dashed border-neutral-700 bg-transparent px-2 py-1.5 text-xs min-h-[32px]" />
                  <button type="submit" data-op="add" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs min-h-[32px]">
                    {pendingKey === "col-add" ? "Adding…" : "Add to collection"}
                  </button>
                  <Button type="submit" data-op="remove" variant="outline" size="sm" className="h-8">
                    {pendingKey === "col-remove" ? "Removing…" : "Remove from collection"}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    if (allSelected) {
                      withConfirm(`Delete all ${totalCount} items? This cannot be undone.`, () => {
                        const fd = new FormData();
                        hiddenTarget(fd);
                        run("delete", bulkDeleteAction, fd, `${totalCount} Item${totalCount === 1 ? "" : "s"} deleted.`, exit);
                      });
                    } else {
                      setConfirmingDelete(true);
                    }
                  }}
                  className="rounded-lg border border-red-500/60 px-3 py-1.5 text-xs text-red-400 min-h-[32px]"
                >
                  Delete…
                </button>
              </div>

              {confirmingDelete && !allSelected ? (
                <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/60 bg-red-500/10 p-2">
                  <span className="text-sm text-red-300">
                    Delete {selected.size} item{selected.size === 1 ? "" : "s"}? This cannot be undone.
                  </span>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs min-h-[32px]">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fd = new FormData();
                      for (const id of selected) fd.append("ids", id);
                      run("delete", bulkDeleteAction, fd, `${selected.size} Item${selected.size === 1 ? "" : "s"} deleted.`, exit);
                    }}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white min-h-[32px]"
                  >
                    {pendingKey === "delete" ? (
                      "Deleting…"
                    ) : (
                      <>
                        Delete {selected.size} item{selected.size === 1 ? "" : "s"}
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </div>

        <div className="mx-auto max-w-6xl px-4 py-4 columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
          {items.map((item) => {
            const on = allSelected || selected.has(item.id);
            return (
              <div
                key={item.id}
                role="checkbox"
                tabIndex={0}
                aria-checked={on}
                aria-label={item.title ?? "Untitled"}
                onPointerDown={() => startLongPress(item.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onClick={() => {
                  if (!longFired.current) toggle(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggle(item.id);
                  }
                }}
                className={`relative cursor-pointer break-inside-avoid overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${on ? "ring-2 ring-neutral-100" : ""}`}
              >
                {item.displayKey ? (
                  <img src={`/media/${item.displayKey}`} alt="" className="w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-24 items-center justify-center bg-neutral-900 px-3 text-center text-neutral-500">{item.title ?? "Untitled"}</span>
                )}
                <span
                  aria-hidden
                  className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
                    on ? "bg-neutral-100 text-neutral-900" : "border border-neutral-400 bg-black/40 text-transparent"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-2 md:hidden">
        <button
          type="button"
          onClick={() => setSelectMode(true)}
          className="min-h-[36px] w-full rounded-lg border border-border text-xs text-muted-foreground"
        >
          Select items
        </button>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-center" role="status">
          {activeFilterCount(state) > 0 ? (
            <>
              <p className="text-foreground">Nothing matches the Filter bar.</p>
              <p className="text-sm text-muted-foreground">Loosen a filter, or clear them all.</p>
            </>
          ) : (
            <>
              <p className="text-foreground">The Wall is empty.</p>
              <p className="text-sm text-muted-foreground">
                <Link href="/capture" className="underline underline-offset-2 hover:text-foreground">
                  Capture something
                </Link>{" "}
                to begin.
              </p>
            </>
          )}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4 items-start md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: colCount }, (_, c) => (
        <div key={c} className="flex flex-col gap-4">
      {items.filter((_, i) => i % colCount === c).map((item) => (
        <figure key={item.id} className="group relative break-inside-avoid overflow-hidden rounded-xl bg-neutral-900">
          <Link
            href={`/items/${item.id}`}
            onPointerDown={() => startLongPress(item.id)}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={(e) => {
              if (longFired.current) {
                e.preventDefault();
                setSelectMode(true);
                setSelected((prev) => new Set(prev).add(item.id));
              }
            }}
            className="block"
          >
            {item.displayKey ? (
              <img
                src={`/media/${item.displayKey}`}
                alt={item.title ?? "Item"}
                loading="lazy"
                decoding="async"
                style={item.aspect ? { aspectRatio: String(item.aspect) } : undefined}
                className="w-full object-cover"
              />
            ) : (
              <span className="flex h-32 items-center justify-center px-3 text-center text-neutral-500">{item.title ?? "Untitled"}</span>
            )}
          </Link>
          <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              aria-label={`Select ${item.title ?? "Untitled"}`}
              onClick={() => {
                setSelectMode(true);
                setSelected((prev) => new Set(prev).add(item.id));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-500 bg-black/60 text-white focus-visible:pointer-events-auto focus-visible:opacity-100"
            >
              <Square className="h-4 w-4" />
            </button>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open source of ${item.title ?? "Untitled"}`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-500 bg-black/60 text-white"
              >
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <figcaption className="px-3 py-2">
            <div className="text-xs">
              <span className="uppercase tracking-wide text-neutral-500">{KIND_LABELS[item.kind] ?? item.kind}</span>
              <span className="ml-2 text-neutral-300">{item.title ?? "Untitled"}</span>
            </div>
            {item.hexColors.length > 0 ? (
              <div className="mt-1.5 flex gap-1">
                {item.hexColors.slice(0, 6).map((hex, i) => (
                  <span key={`${item.id}-${hex}-${i}`} className="inline-block h-3 w-3 rounded-full border border-neutral-700" style={{ backgroundColor: hex }} />
                ))}
              </div>
            ) : null}
            {item.facetTags.length > 0 || item.freeTags.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.facetTags.map((t) => (
                  <span key={`${t.facet}:${t.value}`} className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">
                    {t.value}
                  </span>
                ))}
                {item.freeTags.map((t) => (
                  <span key={t} className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </figcaption>
        </figure>
        ))}
        </div>
      ))}
      </div>
      </div>
    </div>
  );
}
