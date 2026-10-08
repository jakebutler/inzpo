import { notFound } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { KitResult } from "@/app/components/KitResult";
import { SaveBar } from "@/app/components/SaveBar";
import { KitCard } from "@/app/components/KitCard";
import { CaptureForm } from "@/app/capture/CaptureForm";
import { MascotStage } from "@/app/components/MascotStage";
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
  "empty-collection",
  "dark",
] as const;
type FoldState = (typeof STATES)[number];

const FOLD_TITLES: Record<FoldPhoto, string> = {
  IMG_6505: "Yellow Victorian",
  IMG_6208: "Blue storefront",
  IMG_5859: "Red mural",
};

export default async function FoldPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; photo?: string }>;
}) {
  if (!isDevAuthBypassEnabled()) notFound();
  const params = await searchParams;
  const state = (STATES.includes(params.state as FoldState) ? params.state : "result") as FoldState;
  const photo = (PHOTOS.includes(params.photo as FoldPhoto)
    ? params.photo
    : state === "dark" || state === "empty-roles" || state === "chips"
      ? "IMG_6208"
      : "IMG_6505") as FoldPhoto;
  const extracted = await loadFoldKit(photo);
  let colors = extracted.colors;
  if (state === "empty-roles") colors = dropRoles(colors, ["accent", "surface"] as ColorRole[]);
  const chips = state === "chips";
  const saved = state === "saved";
  const reveal =
    state === "mid"
      ? "mid"
      : state === "first" || state === "collection" || state === "empty-collection"
        ? "play"
        : "landed";
  const displayTitle = FOLD_TITLES[photo];

  if (state === "first") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-xl pb-36 pt-6">
          <div className="px-4">
            <h1 className="font-heading mt-4 max-w-[14ch] text-left text-[40px] leading-[1.15] tracking-tight">
              Steal the colors off anything
            </h1>
          </div>
          <div className="mt-5 px-4">
            <CaptureForm shareToken={null} firstOpen>
              <div className="-mx-4 mt-8 flex flex-col">
                <KitCard title={displayTitle} imageSrc={extracted.imageSrc} roles={rolesFromColors(colors)} />
                <KitCard
                  title="Blue storefront"
                  imageSrc="/sample/IMG_6208.jpg"
                  roles={{ ...HANDOFF_KITS.IMG_6208 }}
                />
              </div>
            </CaptureForm>
          </div>
        </div>
      </main>
    );
  }

  if (state === "empty-collection") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="font-heading text-2xl">Street walks</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-32" role="status">
          <MascotStage moment="empty" className="justify-center text-left" />
        </div>
      </main>
    );
  }

  if (state === "collection") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="font-heading text-2xl">Street walks</h1>
          <ExportKitButton collectionId="c1" />
        </header>
        <div className="flex flex-col">
          <KitCard title={displayTitle} imageSrc={extracted.imageSrc} roles={rolesFromColors(colors)} />
          <KitCard title="Blue storefront" imageSrc="/sample/IMG_6208.jpg" roles={{ ...HANDOFF_KITS.IMG_6208 }} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 py-3">
        {saved ? <ExportKitButton itemId="fold" /> : <span />}
      </div>
      <KitResult
        itemId="fold"
        title={displayTitle}
        imageSrc={extracted.imageSrc}
        width={extracted.width}
        height={extracted.height}
        colors={colors}
        tileSrc={null}
        saved={saved}
        preview={{
          namedColors: chips ? [{ hex: "#e8c36a", label: "yellow siding" }] : [],
          status: state === "pending" ? "pending" : "ready",
          text: state === "pending" ? null : "Warm stone against shade.",
          stub: false,
          reveal,
          openRole: state === "edit" ? "primary" : null,
        }}
      />
      <SaveBar
        itemId="fold"
        collections={[{ id: "c1", name: "Street walks" }]}
        defaultOpen={state === "save"}
        saved={saved}
        collectionId={saved ? "c1" : null}
        collectionName={saved ? "Street walks" : null}
      />
    </main>
  );
}
