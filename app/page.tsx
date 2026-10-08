import { getWallItems, countWallItems } from "@/lib/items";
import { EMPTY_FILTER } from "@/lib/filter";
import { listCollections, collectionExists } from "@/lib/collections";
import { getBoards } from "@/lib/item-boards";
import { WallGrid } from "./components/WallGrid";
import { BottomNav } from "./components/BottomNav";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Plus } from "lucide-react";
import { LogoutButton } from "./components/LogoutButton";
import { ExportKitButton } from "./components/ExportKitButton";
import { requireOwnerId } from "@/lib/auth/owner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Wall({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const ownerId = await requireOwnerId();
  const params = await searchParams;
  const collectionId = typeof params.c === "string" && (await collectionExists(ownerId, params.c)) ? params.c : null;
  const state = EMPTY_FILTER;

  const [wallItems, count, collections, boards] = await Promise.all([
    getWallItems(ownerId, state, collectionId),
    countWallItems(ownerId, state, collectionId),
    listCollections(ownerId),
    getBoards(ownerId),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-sm font-medium">
            {collectionId ? collections.find((c) => c.id === collectionId)?.name ?? "Collection" : "Wall"}
          </h1>
          <div className="flex items-center gap-2">
            {collectionId && wallItems[0] ? <ExportKitButton itemId={wallItems[0].id} /> : null}
            <Button asChild size="sm" className="hidden md:inline-flex">
              <a href="/capture">
                <Plus className="h-4 w-4" /> Snap
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link href="/boards">
                <LayoutGrid className="h-4 w-4" /> Boards
              </Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-3">
        <span className="text-xs text-muted-foreground">
          {count} kit{count === 1 ? "" : "s"}
          {collectionId ? (
            <>
              {" "}
              in{" "}
              <Link href="/" className="text-foreground underline decoration-muted-foreground/60">
                {collections.find((c) => c.id === collectionId)?.name ?? "collection"}
              </Link>{" "}
              —{" "}
              <Link href="/" className="underline decoration-muted-foreground/60 hover:text-foreground">
                clear scope
              </Link>
            </>
          ) : null}
        </span>
      </div>

      <BottomNav />
      <WallGrid
        items={wallItems.map((w) => ({
          id: w.id,
          kind: w.kind,
          title: w.title,
          displayKey: w.displayKey,
          aspect: w.aspect,
          hexColors: w.hexColors,
          facetTags: w.facetTags,
          freeTags: w.freeTags,
          sourceUrl: w.sourceUrl,
        }))}
        state={state}
        totalCount={count}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        boards={boards}
        collectionId={collectionId}
      />
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8" />
    </main>
  );
}
