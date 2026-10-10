import type { CollectionSummary } from '@inzpo/shared';
import { StyleSheet, Text, View } from 'react-native';
import { LABEL_STOCK, MATTE_BLUE, OATMEAL_STOCK, stockSurface } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { PaperPressable } from './PaperPressable';
import { PaperTexture } from './PaperTexture';
import { ui } from '@/theme/styles';

export function CollectionFolder({ collection, onPress }: { collection: CollectionSummary; onPress: () => void }) {
  return <PaperPressable accessibilityRole="button" accessibilityLabel={`${collection.name}, ${collection.count} kits`}
    accessibilityHint="Open this collection." onPress={onPress} style={styles.folder}>
    <View pointerEvents="none" accessible={false} style={styles.backing} />
    <View style={styles.tab}><PaperTexture kind="color" />
      <Text style={styles.tabLabel}>{collection.count} {collection.count === 1 ? 'kit' : 'kits'}</Text>
    </View>
    <View style={[stockSurface, styles.face]}>
      <PaperTexture />
      <Text style={styles.name}>{collection.name}</Text>
      <View style={styles.footer}>
        <Text style={[ui.label, { color: MATTE_BLUE }]}>Open collection</Text>
        <View accessible={false} style={styles.arrow} />
      </View>
    </View>
  </PaperPressable>;
}
const styles = StyleSheet.create({
  folder: { marginTop: 4, marginBottom: 12, paddingBottom: 4 },
  backing: { position: 'absolute', top: 29, left: 4, right: -3, bottom: 0, borderRadius: 3,
    backgroundColor: OATMEAL_STOCK, borderWidth: .5, borderColor: '#857B68', transform: [{ rotate: '0.7deg' }] },
  tab: { alignSelf: 'flex-start', marginLeft: 14, marginBottom: -6, minWidth: 80, minHeight: 30, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 7,
    backgroundColor: MATTE_BLUE, borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden' },
  tabLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: LABEL_STOCK },
  face: { padding: 20, gap: 16, borderRadius: 3, minHeight: 122 },
  name: { fontFamily: fonts.heading, fontSize: 29, lineHeight: 36, color: INK },
  footer: { borderTopWidth: 1, borderTopColor: '#D1C5B3', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 8, height: 8, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: MATTE_BLUE, transform: [{ rotate: '45deg' }], marginRight: 2 },
});
