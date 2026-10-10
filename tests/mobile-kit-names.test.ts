import { describe, expect, it } from "vitest";
import { primaryKitTitle, UNTITLED_KIT } from "@/lib/kit-name";

it('builds the mobile default only from Primary, including before the brief resolves', () => {
  expect(primaryKitTitle('#d2d0a8')).toBe('Yellow kit');
  expect(primaryKitTitle('#D2D0A8')).toBe(primaryKitTitle('#d2d0a8'));
  expect(primaryKitTitle('#426092')).toBe('Blue kit');
  expect(primaryKitTitle(null)).toBe(UNTITLED_KIT);
});

describe('generated color + noun names', () => {
  const primary = '#d2d0a8';
  it.each(['House', 'Home', 'Building', 'Townhouse'])('prefers the architectural style over vision subject %s', (subject) => {
    const source = { subject, briefText: 'Yellow siding and white trim on a Victorian townhouse.' };
    expect(primaryKitTitle(primary, source)).toBe('Yellow Victorian');
    expect(primaryKitTitle(primary, source)).toBe(primaryKitTitle(primary, source));
  });
  it.each(['Victorian', 'Craftsman', 'Colonial', 'Bungalow', 'Ranch', 'Tudor'])('recognizes the style %s before generic building details', (style) => {
    expect(primaryKitTitle(primary, { subject: 'House', briefText: `White trim on a ${style} house.` })).toBe(`Yellow ${style}`);
    expect(primaryKitTitle(primary, { subject: `${style} townhouse` })).toBe(`Yellow ${style}`);
  });
  it.each(['Warm and sunlit.', 'Soft buttery and lovely.', 'Yellow Sunlit', 'Yellow Study', '123', '123 Main Street', 'Garden Street', 'Stone Road', 'Garden St', 'Sunset Blvd', '123 Garden Ave', 'IMG_5859.jpg'])('falls back for %s', (text) => {
    expect(primaryKitTitle(primary, { title: text, briefText: text, namedColors: [{ hex: primary, label: text }] })).toBe('Yellow kit');
  });
  it.each([
    ['A sunlit yellow Victorian with a black door.', 'Yellow Victorian'],
    ['Warm stone against shade.', 'Yellow Stone'],
    ['A house at 123 Garden Street.', 'Yellow House'],
    ['A soft ceramic bowl.', 'Yellow Bowl'],
  ])('selects a solid noun from %s', (briefText, expected) => {
    expect(primaryKitTitle(primary, { briefText })).toBe(expected);
  });
  it('gets the noun from photo titles or labels and the color from Primary', () => {
    expect(primaryKitTitle(primary, { title: 'Warm House' })).toBe('Yellow House');
    expect(primaryKitTitle(primary, { namedColors: [{ hex: '#ffffff', label: 'white door' }] })).toBe('Yellow Door');
    expect(primaryKitTitle(primary, { title: 'White Victorian', briefText: 'Soft and sunlit.' })).toBe('Yellow Victorian');
  });
});
