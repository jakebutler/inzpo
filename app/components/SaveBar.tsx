"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addToCollectionAndReturnId } from "@/app/actions/collections";
import { MOTION, MOTION_CSS } from "@/lib/motion";
import { canSaveKit } from "@/lib/save-kit";

const LAST_COLLECTION_KEY = "inzpo-last-collection";

export function SaveBar({
  itemId,
  collections,
  defaultOpen = false,
  saved = false,
  collectionId = null,
  collectionName = null,
}: {
  itemId: string;
  collections: Array<{ id: string; name: string }>;
  defaultOpen?: boolean;
  saved?: boolean;
  collectionId?: string | null;
  collectionName?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const checkRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const last = window.localStorage.getItem(LAST_COLLECTION_KEY);
    if (collectionId && collections.some((c) => c.id === collectionId)) setSelected(collectionId);
    else if (last && collections.some((c) => c.id === last)) setSelected(last);
    else if (collections[0]) setSelected(collections[0].id);
  }, [collections, collectionId]);

  useEffect(() => {
    if (!saved || !checkRef.current) return;
    gsap.fromTo(
      checkRef.current,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: MOTION.small.duration, ease: MOTION.small.ease },
    );
  }, [saved]);

  const selectedName =
    newName.trim() ||
    collections.find((c) => c.id === selected)?.name ||
    collectionName ||
    "New collection";

  function save(targetId: string | "", name = "") {
    if (!canSaveKit({ saved, pending })) return;
    const fd = new FormData();
    fd.set("itemId", itemId);
    if (targetId) fd.set("collectionId", targetId);
    if (name) fd.set("newName", name);
    startTransition(async () => {
      const cid = await addToCollectionAndReturnId(fd);
      if (cid) window.localStorage.setItem(LAST_COLLECTION_KEY, cid);
      router.push(`/items/${itemId}?c=${cid ?? ""}&saved=1`);
      router.refresh();
    });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30" data-save-bar>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-full h-12"
        style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
        aria-hidden
      />
      <div className="pointer-events-auto relative bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {saved ? (
            <Link
              href={collectionId ? `/?c=${collectionId}` : "/"}
              className="min-h-11 flex-1 truncate text-left text-base"
            >
              In {collectionName ?? selectedName} →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-11 flex-1 truncate text-left text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Save to {selectedName} ⌄
            </button>
          )}
          <button
            type="button"
            disabled={!canSaveKit({ saved, pending }) || (!selected && !newName.trim() && !saved)}
            onClick={() => save(selected, newName.trim())}
            className="h-14 min-w-24 bg-primary px-5 text-base font-medium text-primary-foreground disabled:opacity-50"
            style={{ transitionDuration: `${MOTION_CSS.smallMs}ms` }}
          >
            {saved ? (
              <span className="inline-flex items-center gap-2">
                <span ref={checkRef} aria-hidden>
                  <Check className="h-5 w-5" />
                </span>
                Saved
              </span>
            ) : pending ? (
              "Saving…"
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl">Collection</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`flex min-h-11 items-center justify-between px-3 text-left text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${c.id === selected ? "bg-secondary" : ""}`}
                onClick={() => {
                  setSelected(c.id);
                  setNewName("");
                  setCreating(false);
                  setOpen(false);
                }}
              >
                <span>{c.name}</span>
                {c.id === selected ? <Check className="h-4 w-4" aria-hidden /> : null}
              </button>
            ))}
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
                  className="min-h-11 flex-1 border border-current bg-background px-3 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <button type="submit" className="min-h-11 px-3 text-base">
                  Create
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="min-h-11 px-3 text-left text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setCreating(true)}
              >
                + New collection
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
