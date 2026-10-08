"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BAKU_MET_STORAGE_KEY, MASCOT_SIZE_INTRO_PX } from "@/lib/mascot";
import { gatedTextColor } from "@/lib/contrast";
import { INK, PAPER } from "@/lib/brand";
import { MascotStage } from "./MascotStage";

export function CaptureMascotLayer({
  firstOpen,
  hasSubstance,
  uploading = false,
  progress = null,
}: {
  firstOpen: boolean;
  hasSubstance: boolean;
  uploading?: boolean;
  progress?: string | null;
}) {
  const { pending } = useFormStatus();
  const waiting = pending || uploading;
  const [met, setMet] = useState(!firstOpen);
  const introInk = gatedTextColor(INK, PAPER, 4.5);

  useEffect(() => {
    setMet(window.localStorage.getItem(BAKU_MET_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!waiting && !hasSubstance) return;
    if (window.localStorage.getItem(BAKU_MET_STORAGE_KEY) === "1") return;
    window.localStorage.setItem(BAKU_MET_STORAGE_KEY, "1");
    setMet(true);
  }, [waiting, hasSubstance]);

  if (waiting) {
    return <MascotStage moment="upload" snapReady immediate className="mt-4" progress={progress} />;
  }

  if (firstOpen && !met && !hasSubstance) {
    return (
      <MascotStage
        moment="first-open"
        snapReady
        size={MASCOT_SIZE_INTRO_PX}
        className="mt-6"
        glow
        ink={introInk}
        onShown={() => {
          window.localStorage.setItem(BAKU_MET_STORAGE_KEY, "1");
        }}
      />
    );
  }

  return null;
}
