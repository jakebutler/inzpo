"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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

function ConfirmDelete({
  label,
  name,
  description,
  action,
  id,
  onOpenChange,
}: {
  label: string;
  name: string;
  description: string;
  action: (fd: FormData) => Promise<void>;
  id: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground hover:text-red-400"
          aria-label={`Delete ${label} ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label} “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>{description} This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
  const [confirming, setConfirming] = useState(false);
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
    if (naming || renaming) nameRef.current?.focus();
  }, [naming, renaming]);

  const cancelButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
    >
      <X className="h-3 w-3" />
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setNaming(false);
          setRenaming(null);
          setConfirming(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm min-h-[36px] hover:border-neutral-500"
        >
          Saved
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="Saved"
        onInteractOutside={(e) => {
          if (confirming) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (confirming) e.preventDefault();
        }}
        className="max-h-[75vh] w-72 gap-0 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-xl ring-0"
      >
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Smart collections</h3>
        {entries.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">None yet — save the current Filter bar as one below.</p>
        ) : null}
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
                    aria-label="Smart collection name"
                    className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-900">
                    Save
                  </button>
                  {cancelButton("Cancel rename", () => setRenaming(null))}
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
                    <span className="ml-2 text-xs text-muted-foreground">{counts[entry.id] ?? "…"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(entry.id)}
                    className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground hover:text-neutral-300"
                    aria-label={`Rename ${entry.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <ConfirmDelete
                    label="Smart collection"
                    name={entry.name}
                    id={entry.id}
                    action={deleteSavedAction}
                    onOpenChange={setConfirming}
                    description="Only the saved Filter bar state is removed; no Item is touched."
                  />
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
              aria-label="Smart collection name"
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
            />
            <button type="submit" className="rounded bg-neutral-100 px-2 py-1.5 text-xs font-medium text-neutral-900">
              Save
            </button>
            {cancelButton("Cancel", () => setNaming(false))}
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

        <h3 className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Collections</h3>
        {collections.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">None yet — add Items from their detail view.</p>
        ) : null}
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
                    aria-label="Collection name"
                    className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-900">
                    Save
                  </button>
                  {cancelButton("Cancel rename", () => setRenaming(null))}
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
                    <span className="ml-2 text-xs text-muted-foreground">{col.count}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(`c:${col.id}`)}
                    className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground hover:text-neutral-300"
                    aria-label={`Rename collection ${col.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <ConfirmDelete
                    label="Collection"
                    name={col.name}
                    id={col.id}
                    action={deleteCollectionAction}
                    onOpenChange={setConfirming}
                    description={`The ${col.count} Item${col.count === 1 ? "" : "s"} in it stay in the library.`}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
