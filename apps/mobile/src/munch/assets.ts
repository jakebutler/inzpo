import { PixelRatio } from 'react-native';

// Metro resolves these logical names to the matching @2x/@3x asset. Requiring
// a scale suffix directly fails asset resolution during native export.
export const atlasSources = [
  require('../../assets/munch/baku-0.webp'), require('../../assets/munch/baku-1.webp'),
  require('../../assets/munch/baku-2.webp'), require('../../assets/munch/baku-3.webp'),
];
export const stripeSources = [
  require('../../assets/munch/stripes-0.webp'), require('../../assets/munch/stripes-1.webp'),
  require('../../assets/munch/stripes-2.webp'), require('../../assets/munch/stripes-3.webp'),
];
export const atlasDensity = PixelRatio.get() > 2 ? 3 : 2;
export const testPhoto = require('../../assets/munch/test-house.jpg');
