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
import { PhotoBackButton } from "./components/PhotoBackButton";
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
      <header className="sticky top-0 z-10 bg-background">
        <div
          className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3"
          style={{ paddingTop: collectionId ? "calc(env(safe-area-inset-top, 0px) + 8px)" : undefined }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {collectionId ? <PhotoBackButton href="/" placement="header" /> : null}
            <h1 className="font-heading text-2xl">
              {collectionId ? collections.find((c) => c.id === collectionId)?.name ?? "Collection" : "Wall"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {collectionId && wallItems.length > 0 ? <ExportKitButton collectionId={collectionId} /> : null}
            <Button asChild size="sm" className="hidden md:inline-flex">
              <a href="/capture">
                <Plus className="h-4 w-4" /> Snap something
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
        <span className="text-base">
          {count} kit{count === 1 ? "" : "s"}
          {collectionId ? (
            <>
              {" "}
              in {collections.find((c) => c.id === collectionId)?.name ?? "collection"} ·{" "}
              <Link href="/" className="underline decoration-muted-foreground/60 hover:text-foreground">
                Show all
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
          note: w.note,
          createdAt: w.createdAt,
          displayKey: w.displayKey,
          aspect: w.aspect,
          hexColors: w.hexColors,
          roles: w.roles,
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
