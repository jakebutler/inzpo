import { aaPassLabel, contrastLineCopy, gatedTextColor, textOnBackgroundContrast } from "@/lib/contrast";
import type { RoleColors } from "@/lib/tokens";

export function ContrastAa({ roles, onFix, pending = false }: { roles: RoleColors; onFix?: () => void; pending?: boolean }) {
  const ratio = textOnBackgroundContrast(roles);
  if (ratio == null) {
    return (
      <p data-contrast-line className="px-5 py-4 text-base leading-snug">
        {contrastLineCopy(roles)}
      </p>
    );
  }
  const bg = roles.background!;
  const ink = gatedTextColor(roles.text, bg);
  return (
    <div
      data-contrast-line
      className="flex w-full min-h-16 items-center justify-between gap-3 px-5 py-3"
      style={{ backgroundColor: bg, color: ink }}
    >
      <span data-contrast-sample className="font-sans text-[40px] leading-none" style={{ color: roles.text! }}>Aa</span>
      <span className="font-mono text-base tabular-nums">{contrastLineCopy(roles)}</span>
      <span className="flex items-center gap-2 text-base">
        <span>{aaPassLabel(ratio)}</span>
        {ratio < 4.5 && onFix ? (
          <button type="button" aria-label="Fix text contrast" onClick={onFix} disabled={pending} className="min-h-11 min-w-11 px-2 underline">
            Fix
          </button>
        ) : null}
      </span>
    </div>
  );
}
