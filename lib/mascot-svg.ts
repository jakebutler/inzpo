/** Shared Baku geometry. ViewBox is 64×64; product size is 48px. */

export const BAKU_VIEWBOX = "0 0 64 64";

export const BAKU_BODY_D =
  "M32 7C36.2 6.4 40.4 8.2 42.2 12.2C50.4 13.6 56.4 20.2 56.8 31C57.2 43.2 49.6 53.4 32 57.6C14.4 53.4 6.8 43.2 7.2 31C7.6 20.2 13.6 13.6 21.8 12.2C23.6 8.2 27.8 6.4 32 7Z";

export const BAKU_TRUNK_D =
  "M29.4 35.2C27.4 42.2 27 49.4 29.6 55.6C30.6 57.8 33.4 57.8 34.4 55.6C37 49.4 36.6 42.2 34.6 35.2C33.6 33.8 30.4 33.8 29.4 35.2Z";

export const BAKU_STRIPE_DS = [
  "M4 20Q32 17.6 60 20V25.5Q32 23.1 4 25.5Z",
  "M4 25.5Q32 23.1 60 25.5V31Q32 28.6 4 31Z",
  "M4 31Q32 28.6 60 31V36.5Q32 34.1 4 36.5Z",
  "M4 36.5Q32 34.1 60 36.5V42Q32 39.6 4 42Z",
  "M4 42Q32 39.6 60 42V47.5Q32 45.1 4 47.5Z",
  "M4 47.5Q32 45.1 60 47.5V53Q32 50.6 4 53Z",
] as const;

export const BAKU_SEAM_DS = [
  "M4 25.5Q32 23.1 60 25.5",
  "M4 31Q32 28.6 60 31",
  "M4 36.5Q32 34.1 60 36.5",
  "M4 42Q32 39.6 60 42",
  "M4 47.5Q32 45.1 60 47.5",
] as const;

export const BAKU_STRIPE_VARS = [
  "var(--baku-primary)",
  "var(--baku-secondary)",
  "var(--baku-accent)",
  "var(--baku-background)",
  "var(--baku-surface)",
  "var(--baku-text)",
] as const;

const STRIPE_CLASSES = [
  "baku-stripe baku-stripe-primary",
  "baku-stripe baku-stripe-secondary",
  "baku-stripe baku-stripe-accent",
  "baku-stripe baku-stripe-background",
  "baku-stripe baku-stripe-surface",
  "baku-stripe baku-stripe-text",
] as const;

/** Inline SVG placeholder markup (no Rive). Used for size reports and 48px shots. */
export function bakuSvgMarkup(clipId = "baku-clip"): string {
  const stripes = BAKU_STRIPE_DS.map(
    (d, i) => `<path class="${STRIPE_CLASSES[i]}" d="${d}"/>`,
  ).join("");
  const seams = BAKU_SEAM_DS.map((d) => `<path class="baku-seam" d="${d}"/>`).join("");
  return `<svg viewBox="${BAKU_VIEWBOX}" width="48" height="48" focusable="false" aria-hidden="true"><defs><clipPath id="${clipId}"><path d="${BAKU_BODY_D}"/></clipPath></defs><g class="baku-body"><path class="baku-coat" d="${BAKU_BODY_D}"/><g clip-path="url(#${clipId})">${stripes}${seams}</g></g><g class="baku-eyes"><ellipse cx="24.5" cy="19.5" rx="3.15" ry="3.55" fill="#2a2420"/><ellipse cx="39.5" cy="19.5" rx="3.15" ry="3.55" fill="#2a2420"/><circle cx="25.6" cy="18.4" r="0.95" fill="#f3ead8"/><circle cx="40.6" cy="18.4" r="0.95" fill="#f3ead8"/></g><g class="baku-trunk"><path d="${BAKU_TRUNK_D}" fill="var(--baku-cream)"/><ellipse cx="32" cy="55.4" rx="2.3" ry="1.35" fill="#c9b89a"/></g></svg>`;
}

export function bakuPlaceholderBytes(): number {
  return new TextEncoder().encode(bakuSvgMarkup()).length;
}
