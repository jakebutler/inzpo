import { COLOR_ROLES, type MobileCollection } from '@inzpo/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaperPressable } from './PaperPressable';
import { PaperTexture } from './PaperTexture';
import { stockSurface, OATMEAL_STOCK } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { ui } from '@/theme/styles';

type Kit = MobileCollection['kits'][number];
export function CollectionKitCard({ kit, onPress }: { kit: Kit; onPress: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasPhoto = kit.photo && failedUrl !== kit.photo.url;
  const count = COLOR_ROLES.filter(role => kit.roles[role]).length;
  return <PaperPressable accessibilityRole="button" accessibilityLabel={`Open ${kit.title}`}
    accessibilityHint="Open this saved kit to edit or use its colors." onPress={onPress}
    testID={`collection-kit-${kit.id}`} style={[stockSurface, styles.kit]}>
    <PaperTexture />
    <View style={styles.photo}>
      {hasPhoto ? <Image source={{ uri: kit.photo!.url }} contentFit="cover" style={StyleSheet.absoluteFill}
        accessibilityLabel={`Photo for ${kit.title}`} onError={() => setFailedUrl(kit.photo!.url)} />
        : <View style={styles.fallback}><Text style={ui.body}>{kit.photo ? 'Photo unavailable' : 'No photo in this kit.'}</Text>
          <Text style={ui.label}>Your colors are still here.</Text></View>}
    </View>
    <View style={styles.colors} accessible accessibilityLabel={COLOR_ROLES.map(role => `${role}: ${kit.roles[role] ?? 'No color yet'}`).join(', ')}>
      {COLOR_ROLES.map((role, index) => <View key={role} style={[styles.chip, { transform: [{ rotate: `${[1.4, -.8, 1, -1.2, .6, -.4][index]}deg` }] }]}>
        <View style={{ flex: 1, backgroundColor: kit.roles[role] ?? OATMEAL_STOCK }}><PaperTexture kind="color" /></View>
        <View style={{ height: 6 }} />
      </View>)}
    </View>
    <View style={{ paddingHorizontal: 4, gap: 4 }}>
      <Text allowFontScaling style={styles.title}>{kit.title}</Text>
      <Text style={ui.label}>{count} {count === 1 ? 'color' : 'colors'} to make your own</Text>
    </View>
  </PaperPressable>;
}
const styles = StyleSheet.create({
  kit: { padding: 12, gap: 14, borderRadius: 3, marginVertical: 8 },
  photo: { height: 204, width: '100%', backgroundColor: OATMEAL_STOCK, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 30, color: INK },
  colors: { flexDirection: 'row', gap: 5, paddingHorizontal: 3, marginTop: -34 },
  chip: { flex: 1, height: 54, padding: 2, backgroundColor: '#FFFCF5',
    boxShadow: [{ offsetX: 1, offsetY: 2, blurRadius: 2, color: '#1C1B1933' }] },
});
