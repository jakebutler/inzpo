import { CaptureForm } from "./CaptureForm";
import { getWallItems } from "@/lib/items";
import { MascotStage } from "@/app/components/MascotStage";
import { KitCard } from "@/app/components/KitCard";
import { SAMPLE_KIT } from "@/lib/sample-kit";
import { requireOwnerId } from "@/lib/auth/owner";
import { EMPTY_FILTER } from "@/lib/filter";
import { kitDisplayName } from "@/lib/kit-name";
import { LINKS_UNSUPPORTED_ERROR, LINKS_UNSUPPORTED_MESSAGE, isLinksUnsupportedRequest } from "@/lib/links";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ERRORS: Record<string, string> = {
  "missing-image": "Pick a photo first.",
  "capture-failed": "That one didn't go through. Try again.",
  [LINKS_UNSUPPORTED_ERROR]: LINKS_UNSUPPORTED_MESSAGE,
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; url?: string; shareToken?: string }>;
}) {
  const ownerId = await requireOwnerId();
  const params = await searchParams;
  const unreadable = params.error === "bad-image";
  const linksBlocked = isLinksUnsupportedRequest(params);
  const recent = (await getWallItems(ownerId, EMPTY_FILTER, null)).slice(0, 3);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl pb-36 pt-6">
        <div className="px-4">
          <h1 className="font-heading mt-4 max-w-[14ch] text-left text-[40px] leading-[1.15] tracking-tight">
            Steal the colors off anything
          </h1>

          {linksBlocked ? (
            <p role="status" className="mt-3 text-base">
              {LINKS_UNSUPPORTED_MESSAGE}
            </p>
          ) : unreadable ? (
            <div className="mt-4">
              <MascotStage moment="error-unreadable" snapReady />
            </div>
          ) : params.error ? (
            <p role="alert" className="mt-3 text-base text-primary">
              {ERRORS[params.error] ?? "That didn't work. Try again."}
            </p>
          ) : null}
        </div>

        <div className="mt-5 px-4">
          <CaptureForm shareToken={params.shareToken ?? null} firstOpen={!params.error}>
            <div className="-mx-4 mt-8 flex flex-col">
              {(recent.length > 0 ? recent : [null]).map((item) => {
                if (!item) {
                  return (
                    <KitCard
                      key="sample"
                      title={SAMPLE_KIT.title}
                      imageSrc={SAMPLE_KIT.imageSrc}
                      hexes={[...SAMPLE_KIT.hexes]}
                    />
                  );
                }
                return (
                  <KitCard
                    key={item.id}
                    title={kitDisplayName({ title: item.title, briefText: item.note })}
                    imageSrc={item.displayKey ? `/media/${item.displayKey}` : null}
                    hexes={item.hexColors}
                  />
                );
              })}
            </div>
          </CaptureForm>
        </div>
      </div>
    </main>
  );
}
