"use client";

import { MASCOT_SIZE_BRIEF_PX, type MascotKit } from "@/lib/mascot";
import { gatedTextColor } from "@/lib/contrast";
import { INK, PAPER } from "@/lib/brand";
import { Mascot } from "./Mascot";
import { MascotStage } from "./MascotStage";

export type BriefSlotStatus = "pending" | "ready" | "failed";

export function BriefSlot({
  status,
  kit,
  note,
  onRetry,
  stripeReveal,
  saved = false,
  hidden = false,
  pageBackground = PAPER,
  pageInk = INK,
}: {
  status: BriefSlotStatus;
  kit: MascotKit;
  note: string | null;
  onRetry?: () => void;
  stripeReveal?: number | null;
  saved?: boolean;
  hidden?: boolean;
  pageBackground?: string;
  pageInk?: string;
}) {
  if (hidden && !saved) return null;
  const ink = gatedTextColor(pageInk, pageBackground, 4.5);
  const mascot = {
    kit,
    size: MASCOT_SIZE_BRIEF_PX,
    snapReady: false,
    revealedCount: stripeReveal,
    ink,
  } as const;

  if (saved) {
    return (
      <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
        <MascotStage moment="success" {...mascot} />
      </section>
    );
  }
  if (status === "pending") {
    return (
      <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
        <MascotStage moment="brief" {...mascot} />
      </section>
    );
  }
  if (status === "failed") {
    return (
      <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
        <MascotStage moment="error-brief" onRetry={onRetry} {...mascot} />
      </section>
    );
  }
  if (!note) return null;
  return (
    <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
      <div className="flex items-start gap-3">
        <div style={{ width: MASCOT_SIZE_BRIEF_PX, height: MASCOT_SIZE_BRIEF_PX, flex: "0 0 auto" }}>
          <Mascot pose="chewing" kit={kit} size={MASCOT_SIZE_BRIEF_PX} revealedCount={stripeReveal} />
        </div>
        <p className="font-heading min-w-0 text-[22px] leading-7" style={{ color: ink }}>
          {note}
        </p>
      </div>
    </section>
  );
}
