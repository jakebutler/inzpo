"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BAKU_MET_STORAGE_KEY } from "@/lib/mascot";
import { MascotStage } from "./MascotStage";

export function CaptureMascotLayer({
  firstOpen,
  hasSubstance,
}: {
  firstOpen: boolean;
  hasSubstance: boolean;
}) {
  const { pending } = useFormStatus();
  const [met, setMet] = useState(true);

  useEffect(() => {
    setMet(window.localStorage.getItem(BAKU_MET_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!pending && !hasSubstance) return;
    if (window.localStorage.getItem(BAKU_MET_STORAGE_KEY) === "1") return;
    window.localStorage.setItem(BAKU_MET_STORAGE_KEY, "1");
    setMet(true);
  }, [pending, hasSubstance]);

  if (pending) {
    return <MascotStage moment="upload" snapReady className="mt-4" />;
  }

  if (firstOpen && !met && !hasSubstance) {
    return (
      <MascotStage
        moment="first-open"
        snapReady
        className="mt-4"
        onShown={() => {
          window.localStorage.setItem(BAKU_MET_STORAGE_KEY, "1");
        }}
      />
    );
  }

  return null;
}
