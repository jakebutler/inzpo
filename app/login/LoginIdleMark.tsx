"use client";

import { COLOR_ROLES } from "@/lib/db/schema";
import { HANDOFF_KITS, MASCOT_SIZE_INTRO_PX } from "@/lib/mascot";
import { Mascot } from "@/app/components/Mascot";

/** Designer-owned login filler: idle Baku plus a thin six-band strip. Easy to tweak or delete. */
const LOGIN_STRIP: Record<(typeof COLOR_ROLES)[number], string> = {
  primary: HANDOFF_KITS.IMG_6505.primary,
  secondary: HANDOFF_KITS.IMG_6505.secondary,
  accent: HANDOFF_KITS.IMG_6505.accent,
  background: HANDOFF_KITS.IMG_6505.background,
  surface: HANDOFF_KITS.IMG_6505.surface,
  text: HANDOFF_KITS.IMG_6505.text,
};

export function LoginIdleMark({ size = MASCOT_SIZE_INTRO_PX }: { size?: number }) {
  const clamped = Math.min(72, Math.max(56, size));
  return (
    <div data-login-idle-mark className="mt-10 flex flex-col items-center gap-5">
      <div style={{ width: clamped, height: clamped }}>
        <Mascot pose="idle" size={clamped} snapReady faceText forcePoseAsset />
      </div>
      <div className="flex w-full max-w-[220px] overflow-hidden rounded-full" aria-hidden>
        {COLOR_ROLES.map((role) => (
          <span key={role} className="h-1.5 flex-1" style={{ backgroundColor: LOGIN_STRIP[role] }} />
        ))}
      </div>
    </div>
  );
}
