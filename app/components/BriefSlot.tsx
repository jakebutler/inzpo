"use client";

import { useEffect, useState } from "react";
import { MASCOT_SIZE_BRIEF_PX, MASCOT_SUCCESS_HOLD_MS, MASCOT_COPY, type MascotKit } from "@/lib/mascot";
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
    faceText: true,
  } as const;

  if (status === "pending" && !saved) {
    return (
      <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
        <MascotStage moment="brief" {...mascot} />
      </section>
    );
  }
  if (status === "failed" && !saved) {
    return (
      <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
        <MascotStage moment="error-brief" onRetry={onRetry} {...mascot} />
      </section>
    );
  }
  if (!note && !saved) return null;
  return (
    <section className="px-5 py-5" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_BRIEF_PX }}>
      <div className="flex items-start gap-3">
        <div style={{ width: MASCOT_SIZE_BRIEF_PX, height: MASCOT_SIZE_BRIEF_PX, flex: "0 0 auto" }}>
          <Mascot
            pose={saved ? "success" : "chewing"}
            kit={kit}
            size={MASCOT_SIZE_BRIEF_PX}
            revealedCount={stripeReveal}
            faceText
          />
        </div>
        <div className="min-w-0">
          {note ? (
            <p className="font-heading text-[22px] leading-7" style={{ color: ink }}>
              {note}
            </p>
          ) : null}
          {saved ? <SavedCaption ink={ink} /> : null}
        </div>
      </div>
    </section>
  );
}

function SavedCaption({ ink }: { ink: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(false), MASCOT_SUCCESS_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <p data-saved-caption className="mt-1 text-sm" style={{ color: ink }}>
      {MASCOT_COPY.success}
    </p>
  );
}
