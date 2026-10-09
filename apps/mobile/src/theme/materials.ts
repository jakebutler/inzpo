import type { ViewStyle } from 'react-native';

export const LABEL_STOCK = '#FBF8F2';
export const OATMEAL_STOCK = '#E4D9C6';
export const SKY_ENAMEL = '#426092';
export const ENAMEL_RIM = '#7E93B5';
export const ENAMEL_LIP = '#2D4163';

// VISUAL-V2 stock: a tight contact shadow and a separate warm ambient shadow.
export const stockSurface: ViewStyle = {
  backgroundColor: LABEL_STOCK,
  borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5,
  borderTopColor: '#FFFFFF99', borderLeftColor: '#FFFFFF88',
  borderRightColor: '#1C1B1930', borderBottomColor: '#1C1B1940',
  boxShadow: [
    { offsetX: 1, offsetY: 2, blurRadius: 1, color: '#1C1B193B' },
    { offsetX: 5, offsetY: 9, blurRadius: 16, color: '#1C1B191A' },
  ],
};
export const liftedStockShadow: ViewStyle['boxShadow'] = [
  { offsetX: 1, offsetY: 2, blurRadius: 1, color: '#1C1B193B' },
  { offsetX: 3, offsetY: 15, blurRadius: 25, color: '#1C1B1945' },
];
