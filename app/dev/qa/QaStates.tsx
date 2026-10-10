"use client";

import { MascotStage } from "@/app/components/MascotStage";
import { KitCard } from "@/app/components/KitCard";
import { TokenEditor } from "@/app/components/TokenEditor";
import { BriefSlot } from "@/app/components/BriefSlot";
import { SaveBar } from "@/app/components/SaveBar";
import { ExportKitButton } from "@/app/components/ExportKitButton";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { HANDOFF_KITS, type MascotKit } from "@/lib/mascot";
import { LINKS_UNSUPPORTED_MESSAGE } from "@/lib/links";

function colorsFromKit(kit: MascotKit) {
  return COLOR_ROLES.filter((role) => kit[role]).map((role, i) => ({
    hex: kit[role]!,
    role,
    position: i,
    pinX: 0.22 + (i % 3) * 0.28,
    pinY: 0.22 + Math.floor(i / 3) * 0.36,
  }));
}

export function QaStates({ issue, state }: { issue: string; state: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[390px] px-4 py-6">
        {state === "empty" || state === "capture-empty" ? (
          <div className="mt-8">
            <h1 className="text-xl font-semibold tracking-tight">Snap</h1>
            <p className="mt-1 text-sm text-muted-foreground">Steal the colors off anything.</p>
            <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Pick a photo, or drop one here
            </div>
            <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[390px] border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground">
                Snap something
              </button>
              <button type="button" className="mt-2 min-h-11 w-full text-sm text-muted-foreground">
                Pick a photo
              </button>
            </div>
          </div>
        ) : null}
        {state === "links" ? (
          <div className="mt-8">
            <h1 className="text-xl font-semibold tracking-tight">Snap</h1>
            <p className="mt-1 text-sm text-muted-foreground">Steal the colors off anything.</p>
            <p role="status" className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              {LINKS_UNSUPPORTED_MESSAGE}
            </p>
            <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[390px] border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground">
                Snap something
              </button>
              <button type="button" className="mt-2 min-h-11 w-full text-sm text-muted-foreground">
                Pick a photo
              </button>
            </div>
          </div>
        ) : null}
        {state === "wall-empty" ? (
          <div className="mt-4">
            <h1 className="text-sm font-medium">Wall</h1>
            <p className="mt-1 text-xs text-muted-foreground">0 kits</p>
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <MascotStage moment="empty" className="justify-center" />
              <p className="text-sm text-muted-foreground">Snap something to begin.</p>
            </div>
          </div>
        ) : null}
        {state === "uploading" ? <MascotStage moment="upload" snapReady className="mt-8" /> : null}
        {state === "saved" ? <MascotStage moment="success" kit={HANDOFF_KITS.IMG_6505} snapReady className="mt-8" /> : null}
        {state === "unreadable" ? <MascotStage moment="error-unreadable" snapReady className="mt-8" /> : null}
        {state === "empty-roles" ? (
          <div className="mt-8">
            <MascotStage moment="success" kit={HANDOFF_KITS.IMG_6208} snapReady />
            <div className="mt-6 grid grid-cols-3 gap-2">
              {["primary", "secondary", "accent", "background", "surface", "text"].map((role) => {
                const hex = HANDOFF_KITS.IMG_6208[role as keyof typeof HANDOFF_KITS.IMG_6208];
                return hex ? (
                  <div key={role} className="h-16 rounded-lg" style={{ backgroundColor: hex }}>
                    <p className="px-2 pt-1 text-[10px] text-white">{role}</p>
                  </div>
                ) : (
                  <button
                    key={role}
                    type="button"
                    className="flex h-16 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-[11px] text-muted-foreground"
                  >
                    add a color
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs tabular-nums text-muted-foreground">Text on background 4.8:1</p>
          </div>
        ) : null}
        {state === "editor-sheet" ? (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Edit primary</p>
            <div className="mt-3 h-40 rounded-xl bg-[#6b6656]" />
            <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">Hex</label>
            <input defaultValue="#6b6656" readOnly className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base tabular-nums" />
            <label className="mt-3 block text-xs uppercase tracking-wide text-muted-foreground">Role</label>
            <select defaultValue="primary" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base">
              <option>primary</option>
              <option>secondary</option>
            </select>
          </div>
        ) : null}
        {state === "one-role" ? (
          <div className="mt-8">
            <MascotStage moment="success" kit={{ ...HANDOFF_KITS.IMG_6505, secondary: null, accent: null, surface: null, text: null, primary: null }} snapReady />
            <div className="mt-6 grid grid-cols-3 gap-2">
              {["primary", "secondary", "accent", "background", "surface", "text"].map((role) =>
                role === "background" ? (
                  <div key={role} className="h-16 rounded-lg" style={{ backgroundColor: HANDOFF_KITS.IMG_6505.background }}>
                    <p className="px-2 pt-1 text-[10px] text-black">{role}</p>
                  </div>
                ) : (
                  <button
                    key={role}
                    type="button"
                    className="flex h-16 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-[11px] text-muted-foreground"
                  >
                    add a color
                  </button>
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No contrast line — text is empty.</p>
          </div>
        ) : null}
        {state === "first-kit" ? (
          <div>
            <p className="mt-8 text-sm text-muted-foreground">Steal the colors off anything</p>
            <div className="mt-6">
              <KitCard title="Sample kit" />
            </div>
            <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[390px] border-t border-border bg-background/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <button type="button" className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground">
                Snap something
              </button>
              <button type="button" className="mt-2 min-h-11 w-full text-sm text-muted-foreground">
                Pick a photo
              </button>
            </div>
          </div>
        ) : null}
        {state === "result-kit" ? (
          <div className="-mx-4 pb-28">
            <div className="relative w-full overflow-hidden bg-[#6b6656]" style={{ aspectRatio: "4 / 5" }}>
              {colorsFromKit(HANDOFF_KITS.IMG_6505).map((c, i) => (
                <span
                  key={c.role}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                  style={{ left: `${c.pinX * 100}%`, top: `${c.pinY * 100}%` }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="px-4 pt-4">
              <TokenEditor itemId="qa" imageSrc={null} colors={colorsFromKit(HANDOFF_KITS.IMG_6505)} />
              <BriefSlot status="pending" kit={HANDOFF_KITS.IMG_6505} note={null} />
            </div>
            <SaveBar itemId="qa" collections={[{ id: "c1", name: "Street walks" }]} />
          </div>
        ) : null}
        {state === "result-empty" ? (
          <div className="-mx-4 pb-28">
            <div className="relative w-full overflow-hidden bg-[#384b5f]" style={{ aspectRatio: "4 / 5" }}>
              {colorsFromKit(HANDOFF_KITS.IMG_6208).map((c, i) => (
                <span
                  key={c.role}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                  style={{ left: `${c.pinX * 100}%`, top: `${c.pinY * 100}%` }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="px-4 pt-4">
              <TokenEditor itemId="qa" imageSrc={null} colors={colorsFromKit(HANDOFF_KITS.IMG_6208)} />
              <BriefSlot status="pending" kit={HANDOFF_KITS.IMG_6208} note={null} />
            </div>
          </div>
        ) : null}
        {state === "result-flat" ? (
          <div className="-mx-4 pb-16">
            <div className="relative w-full bg-[#d1cda4]" style={{ aspectRatio: "4 / 5" }} />
            <div className="px-4 pt-4">
              <TokenEditor
                itemId="qa"
                imageSrc={null}
                colors={[{ hex: "#d1cda4", role: "background" as ColorRole, position: 0, pinX: 0.5, pinY: 0.5 }]}
              />
              <BriefSlot
                status="pending"
                kit={{ ...HANDOFF_KITS.IMG_6505, primary: null, secondary: null, accent: null, surface: null, text: null, background: "#d1cda4" }}
                note={null}
              />
            </div>
          </div>
        ) : null}
        {state === "save-sheet" ? (
          <div className="pb-28">
            <p className="mt-8 text-sm">Last-used collection is preselected. Tap the name for the sheet.</p>
            <SaveBar
              itemId="qa"
              collections={[
                { id: "c1", name: "Street walks" },
                { id: "c2", name: "Murals" },
              ]}
              defaultOpen
            />
          </div>
        ) : null}
        {state === "kit-saved" ? (
          <div className="pb-16">
            <p className="mt-4 text-sm" role="status">
              Saved. Baku is full.
            </p>
            <BriefSlot status="ready" kit={HANDOFF_KITS.IMG_6505} note="Warm stone and shade from a late walk." />
            <header className="mt-6 flex items-center justify-between border-t border-border pt-3">
              <p className="text-sm font-medium">Street walks</p>
              <ExportKitButton itemId="qa" />
            </header>
          </div>
        ) : null}
        {state === "result-texture" ? (
          <section className="mt-8">
            <div
              className="h-40 overflow-hidden rounded-xl border border-border"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #6b6656 25%, #d1cda4 25%, #d1cda4 50%, #6b6656 50%, #6b6656 75%, #d1cda4 75%)",
                backgroundSize: "256px 256px",
              }}
              aria-label="Texture tile"
            />
            <button type="button" className="mt-2 min-h-11 text-sm text-muted-foreground">
              Move crop
            </button>
          </section>
        ) : null}
        {state === "kit-edit" ? (
          <TokenEditor
            itemId="qa"
            imageSrc={
              "data:image/svg+xml," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="#6b6656" width="400" height="500"/></svg>',
              )
            }
            colors={colorsFromKit(HANDOFF_KITS.IMG_6505)}
            initialOpen="primary"
          />
        ) : null}
        {state === "kit-export" ? (
          <header className="mt-8 flex items-center justify-between">
            <h1 className="text-sm font-medium">Street walks</h1>
            <ExportKitButton itemId="qa" />
          </header>
        ) : null}
        {state === "kit-chips" ? (
          <div className="pb-8">
            <TokenEditor
              itemId="qa"
              imageSrc={null}
              colors={colorsFromKit(HANDOFF_KITS.IMG_6208)}
              namedColors={[{ hex: "#e8c36a", label: "yellow door" }]}
            />
            <BriefSlot status="ready" kit={HANDOFF_KITS.IMG_6208} note="Blue shade and a dropped gold." />
          </div>
        ) : null}
        {state === "brief-pending" ? (
          <BriefSlot status="pending" kit={HANDOFF_KITS.IMG_6505} note={null} />
        ) : null}
      </div>
    </main>
  );
}
