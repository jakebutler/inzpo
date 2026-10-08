"use client";

import { MascotStage } from "@/app/components/MascotStage";
import { HANDOFF_KITS } from "@/lib/mascot";
import { MOTION, MOTION_CSS } from "@/lib/motion";

export function QaStates({ issue, state }: { issue: string; state: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[390px] px-4 py-6">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          QA · #{issue} · {state}
        </p>
        {state === "empty" ? (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">Steal the colors off anything</p>
            <div className="mt-24 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Pick a photo
            </div>
            <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[390px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground">
                Snap something
              </button>
              <button type="button" className="mt-2 min-h-11 w-full text-sm text-muted-foreground">
                Pick a photo
              </button>
            </div>
          </div>
        ) : null}
        {state === "uploading" ? <MascotStage moment="upload" snapReady className="mt-8" /> : null}
        {state === "saved" ? <MascotStage moment="success" kit={HANDOFF_KITS.IMG_6505} snapReady className="mt-8" /> : null}
        {state === "unreadable" ? <MascotStage moment="error-unreadable" snapReady className="mt-8" /> : null}
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
