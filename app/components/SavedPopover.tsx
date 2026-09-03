"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCollectionAction, renameCollectionAction } from "@/app/actions/collections";
import { deleteSavedAction, renameSavedAction, saveSearchAction } from "@/app/actions/saved";
import { serializeFilter, type FilterState } from "@/lib/filter";

export interface SavedEntry {
  id: string;
  name: string;
  f: string;
}

export interface CollectionEntry {
  id: string;
  name: string;
  count: number;
}

export function SavedPopover({
  state,
  entries,
  collections,
}: {
  state: FilterState;
  entries: SavedEntry[];
  collections: CollectionEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | "…">>({});
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    for (const entry of entries) {
      fetch("/api/filter-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ f: entry.f }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = (await res.json()) as { count: number };
          setCounts((prev) => ({ ...prev, [entry.id]: body.count }));
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [open, entries]);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm min-h-[36px] hover:border-neutral-500"
        aria-expanded={open}
      >
        Saved
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-xl">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">Smart collections</h3>
          {entries.length === 0 ? <p className="mt-1 text-xs text-neutral-600">None yet.</p> : null}
          <ul className="mt-1 space-y-1">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                {renaming === entry.id ? (
                  <form action={renameSavedAction} className="flex flex-1 items-center gap-1">
                    <input type="hidden" name="id" value={entry.id} />
                    <input
                      ref={nameRef}
                      name="name"
                      defaultValue={entry.name}
                      className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                    />
                    <button type="submit" className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-900">
                      Save
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} className="text-xs text-neutral-500">
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/?f=${entry.f}`);
                      }}
                      className="flex flex-1 items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-900 min-h-[32px]"
                    >
                      <span className="truncate">{entry.name}</span>
                      <span className="ml-2 text-xs text-neutral-500">{counts[entry.id] ?? "…"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(entry.id)}
                      className="px-1 text-xs text-neutral-500 hover:text-neutral-300"
                      aria-label={`Rename ${entry.name}`}
                    >
                      ✎
                    </button>
                    <form action={deleteSavedAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button type="submit" className="px-1 text-xs text-neutral-500 hover:text-red-400" aria-label={`Delete ${entry.name}`}>
                        ✕
                      </button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>

          {naming ? (
            <form action={saveSearchAction} className="mt-2 flex items-center gap-1 border-t border-neutral-800 pt-2">
              <input type="hidden" name="f" value={serializeFilter(state)} />
              <input
                ref={nameRef}
                name="name"
                placeholder="Name this search"
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
              />
              <button type="submit" className="rounded bg-neutral-100 px-2 py-1.5 text-xs font-medium text-neutral-900">
                Save
              </button>
              <button type="button" onClick={() => setNaming(false)} className="text-xs text-neutral-500">
                ✕
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="mt-2 w-full rounded border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-neutral-500"
            >
              + Save this search
            </button>
          )}

          <h3 className="mt-4 text-xs uppercase tracking-wide text-neutral-500">Collections</h3>
          {collections.length === 0 ? <p className="mt-1 text-xs text-neutral-600">None yet — add Items from their detail view.</p> : null}
          <ul className="mt-1 space-y-1">
            {collections.map((col) => (
              <li key={col.id} className="flex items-center gap-1">
                {renaming === `c:${col.id}` ? (
                  <form action={renameCollectionAction} className="flex flex-1 items-center gap-1">
                    <input type="hidden" name="id" value={col.id} />
                    <input
                      ref={nameRef}
                      name="name"
                      defaultValue={col.name}
                      className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                    />
                    <button type="submit" className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-900">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(null)}
                      className="text-xs text-neutral-500"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/?c=${col.id}`);
                      }}
                      className="flex flex-1 items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-900 min-h-[32px]"
                    >
                      <span className="truncate">{col.name}</span>
                      <span className="ml-2 text-xs text-neutral-500">{col.count}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(`c:${col.id}`)}
                      className="px-1 text-xs text-neutral-500 hover:text-neutral-300"
                      aria-label={`Rename collection ${col.name}`}
                    >
                      ✎
                    </button>
                    <form action={deleteCollectionAction}>
                      <input type="hidden" name="id" value={col.id} />
                      <button type="submit" className="px-1 text-xs text-neutral-500 hover:text-red-400" aria-label={`Delete collection ${col.name}`}>
                        ✕
                      </button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

