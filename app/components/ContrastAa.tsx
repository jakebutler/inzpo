import { aaPassLabel, contrastLineCopy, pageChromeColors, textOnBackgroundContrast } from "@/lib/contrast";
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
  const { background: bg, ink } = pageChromeColors(roles);
  return (
    <div
      data-contrast-line
      className="flex w-full min-h-16 items-center justify-between gap-3 px-5 py-3"
      style={{ backgroundColor: bg, color: ink }}
    >
      <span className="font-heading text-[40px] leading-none">Aa</span>
      <span className="font-mono text-base tabular-nums">{contrastLineCopy(roles)}</span>
      <span className="text-base">{aaPassLabel(ratio)}</span>
    </div>
  );
}
