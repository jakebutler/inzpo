"use client";

import { COLOR_ROLES } from "@/lib/db/schema";
import { INK, PAPER, VERMILION } from "@/lib/brand";
import { MASCOT_SIZE_INTRO_PX } from "@/lib/mascot";
import { Mascot } from "@/app/components/Mascot";

/** Designer-owned login filler: idle Baku plus a thin six-band strip. Easy to tweak or delete. */
const LOGIN_STRIP: Record<(typeof COLOR_ROLES)[number], string> = {
  primary: VERMILION,
  secondary: INK,
  accent: "#C4A574",
  background: PAPER,
  surface: "#E4D9C8",
  text: INK,
};

export function LoginIdleMark({ size = MASCOT_SIZE_INTRO_PX }: { size?: number }) {
  const clamped = Math.min(72, Math.max(56, size));
  return (
    <div data-login-idle-mark className="mt-10 flex flex-col items-center gap-5">
      <div className="baku-glow" style={{ width: clamped, height: clamped }}>
        <Mascot pose="idle" size={clamped} snapReady faceText ground={PAPER} />
      </div>
      <div className="flex w-full max-w-[220px] overflow-hidden rounded-full" aria-hidden>
        {COLOR_ROLES.map((role) => (
          <span key={role} className="h-1.5 flex-1" style={{ backgroundColor: LOGIN_STRIP[role] }} />
        ))}
      </div>
    </div>
  );
}
