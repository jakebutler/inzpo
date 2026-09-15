import Link from "next/link";
import { notFound } from "next/navigation";
import { getBoardDetail } from "@/lib/boards";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await getBoardDetail(id);
  if (!board) notFound();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{board.title}</h1>
            <p className="text-xs text-muted-foreground">
              {board.placements.length} item{board.placements.length === 1 ? "" : "s"} · {board.canvasW}×
              {board.canvasH}
            </p>
          </div>
          <Link href="/boards" className="text-xs text-muted-foreground hover:text-foreground">
            ← Boards
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <img
          src={`/boards/${board.id}/image?w=1600&v=${board.updatedAt.getTime()}`}
          alt={`Board ${board.title}`}
          className="h-auto w-full rounded-2xl border border-border"
        />
        <ul className="sr-only" aria-label="Placements">
          {board.placements.map((p) => (
            <li key={p.id}>
              {p.title ?? "Untitled"} — position {p.x},{p.y}, size {p.w}×{p.h}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
