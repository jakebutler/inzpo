/** Plain hue used by both a kit's default name and its Primary annotation. */
export function colorHue(hex: string | null | undefined, name?: string | null): string {
  if (!hex) return 'color';
  // The broad search family lumps yellow paint into cream/beige. Use its RGB
  // hue for display; specific sample labels can still supply a plain name.
  const label = name?.toLowerCase();
  const named = label !== 'cream/beige' && label?.match(/\b(red|orange|yellow|green|blue|purple|pink|brown|cream|black|white|gray|grey)\b/);
  if (named) return named[0];
  if (label?.trim() && label !== 'cream/beige') return label.trim();
  const clean = hex.replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 0.08) return max < 0.15 ? 'black' : min > 0.85 ? 'white' : 'gray';
  const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  return hue < 20 || hue >= 345 ? 'red' : hue < 45 ? 'orange' : hue < 75 ? 'yellow'
    : hue < 165 ? 'green' : hue < 255 ? 'blue' : hue < 300 ? 'purple' : 'pink';
}
