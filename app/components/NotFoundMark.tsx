"use client";

import { MASCOT_SIZE_INTRO_PX } from "@/lib/mascot";
import { PAPER } from "@/lib/brand";
import { Mascot } from "./Mascot";

export function NotFoundMark() {
  return (
    <div className="mt-10" data-not-found-baku>
      <Mascot pose="404" size={MASCOT_SIZE_INTRO_PX} snapReady ground={PAPER} />
    </div>
  );
}
