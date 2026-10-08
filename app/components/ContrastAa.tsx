import { contrastLineCopy, textOnBackgroundContrast } from "@/lib/contrast";
import type { RoleColors } from "@/lib/tokens";

export function ContrastAa({ roles }: { roles: RoleColors }) {
  const ratio = textOnBackgroundContrast(roles);
  if (ratio == null) {
    return (
      <p data-contrast-line className="px-4 text-base leading-snug">
        {contrastLineCopy(roles)}
      </p>
    );
  }
  return (
    <p data-contrast-line className="flex items-center gap-3 px-4 text-base">
      <span
        className="inline-flex h-11 min-w-11 items-center justify-center px-3 text-xl"
        style={{ backgroundColor: roles.background!, color: roles.text! }}
      >
        Aa
      </span>
      <span>{contrastLineCopy(roles)}</span>
    </p>
  );
}
