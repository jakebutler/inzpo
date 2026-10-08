import Link from "next/link";
import { notFound } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { KitResult } from "@/app/components/KitResult";
import { SaveBar } from "@/app/components/SaveBar";
import { KitCard } from "@/app/components/KitCard";
import { CaptureForm } from "@/app/capture/CaptureForm";
import { BandStripe } from "@/app/components/BandStripe";
import { ExportKitButton } from "@/app/components/ExportKitButton";
import { dropRoles, loadFoldKit, type FoldPhoto } from "@/lib/fold-kit";
import { HANDOFF_KITS } from "@/lib/mascot";
import { rolesFromColors } from "@/lib/tokens";
import type { ColorRole } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const PHOTOS: FoldPhoto[] = ["IMG_6505", "IMG_6208", "IMG_5859"];
const STATES = [
  "first",
  "result",
  "mid",
  "pending",
  "chips",
  "edit",
  "save",
  "saved",
  "collection",
  "empty-roles",
  "dark",
] as const;
type FoldState = (typeof STATES)[number];

export default async function FoldPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; photo?: string }>;
}) {
  if (!isDevAuthBypassEnabled()) notFound();
  const params = await searchParams;
  const state = (STATES.includes(params.state as FoldState) ? params.state : "result") as FoldState;
  const photo = (PHOTOS.includes(params.photo as FoldPhoto) ? params.photo : state === "dark" || state === "empty-roles" || state === "chips" ? "IMG_6208" : "IMG_6505") as FoldPhoto;
  const extracted = await loadFoldKit(photo);
  let colors = extracted.colors;
  if (state === "empty-roles") colors = dropRoles(colors, ["accent", "surface"] as ColorRole[]);
  const chips = state === "chips";
  const saved = state === "saved";
  const reveal = state === "mid" ? "mid" : state === "result" || state === "saved" || state === "chips" || state === "empty-roles" || state === "dark" ? "landed" : state === "pending" ? "landed" : "play";

  if (state === "first") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-xl px-4 pb-36 pt-6">
          <p className="text-base">← Wall</p>
          <h1 className="font-heading mt-8 max-w-[14ch] text-left text-[40px] leading-[1.15] tracking-tight">
            Steal the colors off anything
          </h1>
          <div className="mt-8">
            <KitCard title={extracted.title} imageSrc={extracted.imageSrc} roles={rolesFromColors(colors)} />
          </div>
          <CaptureForm shareToken={null} firstOpen={false} />
        </div>
      </main>
    );
  }

  if (state === "collection") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="font-heading text-2xl">Street walks</h1>
          <ExportKitButton itemId="fold" />
        </header>
        <div className="flex flex-col gap-6 px-4 pt-4">
          <BandStripe roles={rolesFromColors(colors)} title={extracted.title} />
          <BandStripe roles={HANDOFF_KITS.IMG_6208} title="IMG_6208" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 py-3">
        <Link href="/" className="text-base">
          ← Wall
        </Link>
        {saved ? <ExportKitButton itemId="fold" /> : null}
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
          status: state === "pending" ? "pending" : chips || saved ? "ready" : "pending",
          text: chips || saved ? "[stub — no DO_INFERENCE_API_KEY] Warm stone against shade." : null,
          stub: chips || saved,
          reveal,
          openRole: state === "edit" ? "primary" : null,
        }}
      />
      <SaveBar
        itemId="fold"
        collections={[{ id: "c1", name: "Street walks" }]}
        defaultOpen={state === "save"}
      />
    </main>
  );
}
