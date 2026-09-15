import Link from "next/link";
import { BOARD_PRESETS, BOARD_PRESET_LABELS, listBoards } from "@/lib/boards";
import { createBoardAction } from "@/app/actions/boards";
import { BottomNav } from "@/app/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boards — Inzpo" };

export default async function BoardsPage() {
  const boards = await listBoards();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Boards</h1>
            <p className="text-xs text-muted-foreground">Compose Items into one exportable image</p>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Wall
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
        {boards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No boards yet. Create one, then add Items from the library.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/boards/${b.id}`}
                  className="block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-neutral-600"
                >
                  <img
                    src={`/boards/${b.id}/image?w=640&v=${b.updatedAt.getTime()}`}
                    alt=""
                    width={b.canvasW}
                    height={b.canvasH}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.count} item{b.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form action={createBoardAction} className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-4">
          <Input name="title" placeholder="New board name" aria-label="New board name" maxLength={120} className="h-9 max-w-56" />
          <select
            name="preset"
            aria-label="Output size"
            defaultValue="free"
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {Object.keys(BOARD_PRESETS).map((p) => (
              <option key={p} value={p}>
                {BOARD_PRESET_LABELS[p as keyof typeof BOARD_PRESETS]}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            New board
          </Button>
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
