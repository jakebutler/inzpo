"use client";

import { MASCOT_SIZE_PX, type MascotKit } from "@/lib/mascot";
import { MascotStage } from "./MascotStage";

export type BriefSlotStatus = "pending" | "ready" | "failed";

/**
 * Result-screen brief slot. Baku stays 48px, never above the photo or palette.
 * Space is held from the start so the palette does not jump when the brief lands.
 */
export function BriefSlot({
  status,
  kit,
  note,
  onRetry,
}: {
  status: BriefSlotStatus;
  kit: MascotKit;
  note: string | null;
  onRetry?: () => void;
}) {
  return (
    <section className="mt-6" aria-label="Brief" style={{ minHeight: MASCOT_SIZE_PX }}>
      {status === "pending" ? (
        <MascotStage moment="brief" kit={kit} size={MASCOT_SIZE_PX} snapReady={false} />
      ) : null}
      {status === "failed" ? (
        <MascotStage
          moment="error-brief"
          kit={kit}
          size={MASCOT_SIZE_PX}
          snapReady={false}
          onRetry={onRetry}
        />
      ) : null}
      {status === "ready" && note ? (
        <p className="text-sm leading-relaxed text-foreground">{note}</p>
      ) : null}
    </section>
  );
}
