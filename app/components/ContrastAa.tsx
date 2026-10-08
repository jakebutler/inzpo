import { aaPassLabel, contrastLineCopy, textOnBackgroundContrast } from "@/lib/contrast";
import { INK, PAPER } from "@/lib/brand";
import type { RoleColors } from "@/lib/tokens";

export function ContrastAa({ roles }: { roles: RoleColors }) {
  const ratio = textOnBackgroundContrast(roles);
  if (ratio == null) {
    return (
      <p data-contrast-line className="px-5 py-4 text-base leading-snug">
        {contrastLineCopy(roles)}
      </p>
    );
  }
  const bg = roles.background ?? PAPER;
  const ink = roles.text ?? INK;
  return (
    <div
      data-contrast-line
      className="flex w-full items-center justify-between gap-3 px-5 py-4"
      style={{ backgroundColor: bg, color: ink }}
    >
      <span className="font-heading text-[40px] leading-none">Aa</span>
      <span className="font-mono text-base tabular-nums">{contrastLineCopy(roles)}</span>
      <span className="text-base">{aaPassLabel(ratio)}</span>
    </div>
  );
}
