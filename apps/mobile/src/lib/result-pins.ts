import { colorHue, COLOR_ROLES, type ColorRole, type MobileKit } from '@inzpo/shared';

export type SamplePoint = { x: number; y: number };
// Older MobileKits lack coordinates. Deterministic normalized points from the
// five actual VISUAL-V2 reference samples, plus a center point for a filled
// Surface. These are visual fallbacks, not claims of sampling a new photo.
export const FALLBACK_PINS: Record<ColorRole, SamplePoint> = {
  primary: { x: 307 / 1500, y: 889 / 2000 }, secondary: { x: 1288 / 1500, y: 358 / 2000 },
  accent: { x: 120 / 1500, y: 81 / 2000 }, background: { x: 1315 / 1500, y: 585 / 2000 },
  surface: { x: 0.5, y: 0.6 }, text: { x: 169 / 1500, y: 129 / 2000 },
};
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function roleSample(kit: Pick<MobileKit, 'roles' | 'colors'>, role: ColorRole): SamplePoint | null {
  const hex = kit.roles[role];
  if (!hex) return null;
  // Ignore stale coordinates after a role edit, and never steal another role's pin.
  const color = kit.colors.find((color) => color.role === role && color.hex.toLowerCase() === hex.toLowerCase()
    && valid(color.pinX) && valid(color.pinY));
  return color ? { x: color.pinX!, y: color.pinY! } : FALLBACK_PINS[role];
}

/** Map normalized source points through the same top/center cover as expo-image. */
export function photoPins(kit: MobileKit, width: number, height: number) {
  const sourceWidth = kit.photo?.width ?? 1500;
  const sourceHeight = kit.photo?.height ?? 2000;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropX = (sourceWidth * scale - width) / 2;
  const cropY = 0;
  return COLOR_ROLES.flatMap((role) => {
    const sample = roleSample(kit, role);
    if (!sample) return [];
    const target = { x: Math.max(0, Math.min(width, sample.x * sourceWidth * scale - cropX)),
      y: Math.max(0, Math.min(height, sample.y * sourceHeight * scale - cropY)) };
    // Displace edge rings into the photo, with a leader to the source spot.
    // Match the two displaced reference dots at 248x330.
    const marker = { x: Math.max(17, Math.min(width - 17, target.x)), y: Math.max(21, Math.min(height - 17, target.y)) };
    if (role === 'accent' && target.y < 21) { marker.x = 17; marker.y = 35; }
    if (role === 'text' && target.x < 45 && target.y < 35) { marker.x = 45; marker.y = 21; }
    return [{ role, color: kit.roles[role]!, sample, target, marker }];
  });
}

export function roleHue(kit: MobileKit, role: ColorRole): string {
  const color = kit.colors.find((color) => color.role === role && color.hex.toLowerCase() === kit.roles[role]?.toLowerCase());
  return colorHue(kit.roles[role], color?.name);
}

export function primaryHue(kit: MobileKit): string { return roleHue(kit, 'primary'); }
