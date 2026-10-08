import Link from "next/link";
import { notFound } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { KitResult } from "@/app/components/KitResult";
import { SaveBar } from "@/app/components/SaveBar";
import { dropRoles, loadFoldKit } from "@/lib/fold-kit";
import type { ColorRole } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STATES = [
  "kit",
  "empty-roles",
  "needs-text",
  "needs-bg",
  "needs-both",
  "chips",
  "chips-saved",
] as const;
type FoldState = (typeof STATES)[number];

export default async function FoldPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (!isDevAuthBypassEnabled()) notFound();
  const params = await searchParams;
  const state = (STATES.includes(params.state as FoldState) ? params.state : "kit") as FoldState;
  const extracted = await loadFoldKit(state === "empty-roles" || state === "chips" || state === "chips-saved" ? "IMG_6208" : "IMG_6505");
  let colors = extracted.colors;
  if (state === "needs-text") colors = dropRoles(colors, ["text"] as ColorRole[]);
  if (state === "needs-bg") colors = dropRoles(colors, ["background"] as ColorRole[]);
  if (state === "needs-both") colors = dropRoles(colors, ["text", "background"]);
  const chips = state === "chips" || state === "chips-saved";
  const saved = state === "chips-saved";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Wall
        </Link>
      </div>
      <KitResult
        itemId="fold"
        title={extracted.title}
        imageSrc={extracted.imageSrc}
        width={extracted.width}
        height={extracted.height}
        colors={colors}
        tileSrc={null}
        saved={saved}
        preview={{
          namedColors: chips ? [{ hex: "#e8c36a", label: "yellow door" }] : [],
          status: chips ? "ready" : "pending",
          text: chips ? "[stub — no DO_INFERENCE_API_KEY] Warm stone against shade." : null,
          stub: chips,
        }}
      />
      <SaveBar itemId="fold" collections={[{ id: "c1", name: "Street walks" }]} />
    </main>
  );
}
