"use client";

import { MascotStage } from "@/app/components/MascotStage";
import { HANDOFF_KITS } from "@/lib/mascot";
import { LINKS_UNSUPPORTED_MESSAGE } from "@/lib/links";
import { MOTION, MOTION_CSS } from "@/lib/motion";

export function QaStates({ issue, state }: { issue: string; state: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[390px] px-4 py-6">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          QA · #{issue} · {state}
        </p>
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
            <p className="mt-3 text-xs text-muted-foreground">Contrast hidden: text and background are both filled, so the line would show.</p>
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
        <dl className="mt-10 space-y-1 text-xs text-muted-foreground" data-motion>
          <div>tap {MOTION.tap.duration}s {MOTION.tap.ease} ({MOTION_CSS.tapMs}ms)</div>
          <div>small {MOTION.small.duration}s {MOTION.small.ease} ({MOTION_CSS.smallMs}ms)</div>
          <div>enter {MOTION.enter.duration}s {MOTION.enter.ease} ({MOTION_CSS.enterMs}ms)</div>
          <div>leave {MOTION.leave.duration}s {MOTION.leave.ease} ({MOTION_CSS.leaveMs}ms)</div>
          <div>reduced {MOTION.reduced.duration}s {MOTION.reduced.ease} ({MOTION_CSS.reducedMs}ms)</div>
        </dl>
      </div>
    </main>
  );
}
