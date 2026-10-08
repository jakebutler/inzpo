"use client";

import { useEffect, useState } from "react";
import {
  MASCOT_SIZE_BRIEF_PX,
  MASCOT_SIZE_PX,
  MASCOT_SUCCESS_HOLD_MS,
  MASCOT_COPY,
  type MascotKit,
  type MascotPose,
} from "@/lib/mascot";
import { gatedTextColor } from "@/lib/contrast";
import { BRIEF_SLOT_MIN_PX, INK, PAPER } from "@/lib/brand";
import { displayBriefSlot } from "@/lib/brief-display";
import { MOTION_CSS } from "@/lib/motion";
import { Mascot } from "./Mascot";

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
  const ink = gatedTextColor(pageInk, pageBackground, 4.5);
  const pose: MascotPose = saved ? "success" : status === "failed" ? "error-brief" : status === "pending" ? "chewing" : "idle";
  const display = status === "pending" && !saved ? MASCOT_COPY.chewing : status === "failed" && !saved ? MASCOT_COPY["error-brief-retry"] : displayBriefSlot(note);
  const [shown, setShown] = useState(display);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (display === shown) {
      setOpacity(1);
      return;
    }
    setOpacity(0);
    const swap = window.setTimeout(() => {
      setShown(display);
      setOpacity(1);
    }, MOTION_CSS.smallMs);
    return () => window.clearTimeout(swap);
  }, [display, shown]);

  if (hidden && !saved) {
    return (
      <section
        className="px-5 py-4"
        aria-label="Brief"
        data-brief-slot
        style={{ minHeight: BRIEF_SLOT_MIN_PX }}
      >
        <div className="flex items-start gap-3">
          <div
            data-baku-slot
            style={{
              width: MASCOT_SIZE_BRIEF_PX,
              height: MASCOT_SIZE_BRIEF_PX,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
            }}
          >
            <Mascot pose={pose} kit={kit} size={MASCOT_SIZE_PX} revealedCount={stripeReveal} faceText />
          </div>
        </div>
      </section>
    );
  }

  const body = (
    <div className="flex items-start gap-3">
      <div
        data-baku-slot
        style={{
          width: MASCOT_SIZE_BRIEF_PX,
          height: MASCOT_SIZE_BRIEF_PX,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
        }}
      >
        <Mascot pose={pose} kit={kit} size={MASCOT_SIZE_PX} revealedCount={stripeReveal} faceText />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {shown ? (
          <p
            className="font-heading line-clamp-3 text-[18px] leading-6"
            style={{
              color: ink,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              opacity,
              transition: `opacity ${MOTION_CSS.smallMs}ms ${MOTION_CSS.easeMove}`,
            }}
          >
            {shown}
          </p>
        ) : null}
        {saved ? <SavedCaption ink={ink} /> : null}
      </div>
    </div>
  );

  if (status === "failed" && !saved) {
    return (
      <section className="px-5 py-4" aria-label="Brief" data-brief-slot style={{ minHeight: BRIEF_SLOT_MIN_PX }}>
        <button type="button" onClick={onRetry} className="block w-full text-left" aria-label={MASCOT_COPY["error-brief-retry"]}>
          {body}
        </button>
      </section>
    );
  }

  return (
    <section className="px-5 py-4" aria-label="Brief" data-brief-slot style={{ minHeight: BRIEF_SLOT_MIN_PX }}>
      {body}
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
