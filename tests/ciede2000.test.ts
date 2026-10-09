import { expect, it } from 'vitest';
import { ciede2000 } from './helpers/ciede2000';

it('matches CIEDE2000 reference pairs, including achromatic colors', () => {
  expect(ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
  expect(ciede2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4);
  expect(ciede2000([50, 0, 0], [50, 0, 0])).toBe(0);
});
