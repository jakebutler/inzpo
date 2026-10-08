"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addToCollectionAndReturnId } from "@/app/actions/collections";
import { MOTION_CSS } from "@/lib/motion";

const LAST_COLLECTION_KEY = "inzpo-last-collection";

export function SaveBar({
  itemId,
  collections,
  defaultOpen = false,
}: {
  itemId: string;
  collections: Array<{ id: string; name: string }>;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const last = window.localStorage.getItem(LAST_COLLECTION_KEY);
    if (last && collections.some((c) => c.id === last)) setSelected(last);
    else if (collections[0]) setSelected(collections[0].id);
  }, [collections]);

  const selectedName =
    newName.trim() || collections.find((c) => c.id === selected)?.name || "New collection";

  function save(collectionId: string | "", name = "") {
    const fd = new FormData();
    fd.set("itemId", itemId);
    if (collectionId) fd.set("collectionId", collectionId);
    if (name) fd.set("newName", name);
    startTransition(async () => {
      const cid = await addToCollectionAndReturnId(fd);
      if (cid) window.localStorage.setItem(LAST_COLLECTION_KEY, cid);
      router.push(`/items/${itemId}?c=${cid ?? ""}&saved=1`);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur" data-save-bar>
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 flex-1 truncate rounded-lg border border-border px-3 text-left text-sm"
        >
          {selectedName}
        </button>
        <button
          type="button"
          disabled={pending || (!selected && !newName.trim())}
          onClick={() => save(selected, newName.trim())}
          className="h-14 min-w-24 rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground disabled:opacity-50"
          style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Collection</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {creating ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newName.trim();
                  if (!name) return;
                  setSelected("");
                  setOpen(false);
                  save("", name);
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setSelected("");
                  }}
                  placeholder="Collection name"
                  aria-label="New collection name"
                  className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                />
                <button type="submit" className="min-h-11 rounded-lg px-3 text-sm">
                  Create
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="min-h-11 rounded-lg border border-dashed border-border px-3 text-left text-sm"
                onClick={() => setCreating(true)}
              >
                New collection
              </button>
            )}
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`min-h-11 rounded-lg px-3 text-left text-sm ${c.id === selected ? "bg-muted" : ""}`}
                onClick={() => {
                  setSelected(c.id);
                  setNewName("");
                  setCreating(false);
                  setOpen(false);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
