import type { ColorRole, MobileKit } from '@inzpo/shared';
import { contrastRatio } from './contrast';
import { roleHue } from './result-pins';

// A single role owns the raised layer. Repeating the role returns it to the table.
export function toggleChip(current: ColorRole | null, role: ColorRole): ColorRole | null {
  return current === role ? null : role;
}

export const CHIP_FLIP = { liftMs: 120, rotationMs: 420, fadeMs: 150, perspective: 900 } as const;
export function chipFlipTiming(reducedMotion: boolean) {
  return reducedMotion ? { path: 'crossfade' as const, openMs: 150, closeMs: 150 }
    : { path: 'rotate' as const, openMs: 540, closeMs: 540 };
}

export function chipReadability(kit: MobileKit, role: ColorRole) {
  const hue = roleHue(kit, role);
  const color = kit.roles[role];
  const passes = !!color && !!kit.roles.text && contrastRatio(kit.roles.text, color) >= 4.5;
  const copy = !kit.roles.text ? 'Add a text color to check how it reads here.'
    : passes ? `Your text color reads well on this ${hue}.`
      : `Your text color is hard to read on this ${hue}. Try a different one.`;
  return { hue, passes, copy };
}
