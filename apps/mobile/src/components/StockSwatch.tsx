import { StyleSheet, Text, View } from 'react-native';
import { LABEL_STOCK, OATMEAL_STOCK } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { PaperTexture } from './PaperTexture';

/** Real color on a small piece of stock; an empty role is unpainted, never cream paint. */
export function StockSwatch({ color, label, testID }: { color: string | null; label?: string; testID?: string }) {
  return <View style={styles.stock}>
    <View testID={testID} style={[styles.paint, { backgroundColor: color ?? OATMEAL_STOCK }, !color && styles.empty]}>
      <PaperTexture kind={color ? 'color' : 'paper'} opacity={color ? 1 : .25} />
      {!color && <View accessible={false} style={styles.blankMark} />}
    </View>
    {label ? <Text style={styles.label}>{label}</Text> : <View style={styles.foot} />}
  </View>;
}
const styles = StyleSheet.create({
  stock: { flex: 1, padding: 3, backgroundColor: LABEL_STOCK, borderRadius: 3,
    borderWidth: .5, borderColor: '#857B68',
    boxShadow: [{ offsetX: 1, offsetY: 2, blurRadius: 3, color: '#1C1B1926' }] },
  paint: { flex: 1, minHeight: 26, borderWidth: .5, borderColor: '#857B68' },
  empty: { borderStyle: 'dashed' },
  blankMark: { width: '42%', height: 1, backgroundColor: '#857B68', alignSelf: 'center', marginVertical: 13 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: INK, paddingTop: 4, textAlign: 'center' },
  foot: { height: 5 },
});
