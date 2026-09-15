import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { freeTags } from "@/lib/db/schema";
import { getBoardDetail } from "@/lib/boards";
import { getFacetsWithValues } from "@/lib/ontology";
import { COLOR_FAMILIES } from "@/lib/colors";
import { BoardEditor } from "./BoardEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Board editor — Inzpo" };

async function loadBoardEditor(id: string) {
  const [board, facets, tagRows] = await Promise.all([
    getBoardDetail(id),
    getFacetsWithValues(),
    db.select({ name: freeTags.name }).from(freeTags).orderBy(freeTags.name),
  ]);
  if (!board) return null;
  return {
    board,
    facets: facets.map((f) => ({ id: f.id, name: f.name, values: f.values.map((v) => v.value) })),
    families: [...COLOR_FAMILIES],
    freeTags: tagRows.map((t) => t.name),
  };
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadBoardEditor(id);
  if (!data) notFound();
  const { board } = data;
  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <BoardEditor board={board} facets={data.facets} families={data.families} freeTags={data.freeTags} />
      <ul className="sr-only" aria-label="Placements">
        {board.placements.map((p) => (
          <li key={p.id}>
            {p.title ?? "Untitled"} — position {p.x},{p.y}, size {p.w}×{p.h}
          </li>
        ))}
      </ul>
    </main>
  );
}
