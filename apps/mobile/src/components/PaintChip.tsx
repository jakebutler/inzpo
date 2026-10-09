import type { ColorRole } from '@inzpo/shared';
import { Canvas, Line, Path, Skia } from '@shopify/react-native-skia';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { contrastTextColor } from '@/lib/contrast';
import { shade } from '@/theme/buttons';
import { LABEL_STOCK, liftedStockShadow, OATMEAL_STOCK, stockSurface } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { PaperTexture } from './PaperTexture';

const referenceTints: Record<string, readonly string[]> = {
  '#d1cb9e': ['#E6E2CA', '#DBD6B3', '#A39E7B'], '#6f6c58': ['#B0AEA3', '#8F8C7D', '#575445'],
  '#426092': ['#97A8C3', '#6C83AA', '#334B72'], '#d0c7b2': ['#E5E0D5', '#DAD3C3', '#A29B8B'],
  '#050404': ['#767575', '#3C3B3B', '#040303'],
};
const registration = Skia.Path.MakeFromSVGString('M3 0 Q7 1 5 5 Q1 7 0 3 Q0 0 3 0 M2 -2 L2 8 M-2 2 L8 2');

export function PaintChip({ role, color, width, height, typeSize = 44 / 3, lifted = false, deck = false, labelInset = 36 }: {
  role: ColorRole; color: string | null; width: number; height: number; typeSize?: number; lifted?: boolean; deck?: boolean; labelInset?: number;
}) {
  const stock = color ? LABEL_STOCK : OATMEAL_STOCK;
  const { fontScale } = useWindowDimensions();
  // All readable print sits on measured stock, never on an arbitrary swatch.
  const ink = contrastTextColor(stock);
  const readableWidth = width - (deck ? labelInset + 4 : 8);
  const roleLines = Math.ceil(role.length * typeSize * 0.58 * fontScale / readableWidth);
  const hexLines = Math.ceil((color?.length ?? 0) * typeSize * 0.6 * fontScale / readableWidth);
  const labelHeight = Math.max(height * 0.3, typeSize * 1.2 * fontScale * (roleLines + hexLines) + (deck ? 19 : 9));
  const bodyHeight = Math.max(0, height - labelHeight);
  const tints = color ? referenceTints[color.toLowerCase()] ?? [shade(color, 0.45), shade(color, 0.22), shade(color, -0.22)] : [];
  return (
    <View style={[styles.card, stockSurface, { width, minHeight: height, backgroundColor: stock }, lifted && { boxShadow: liftedStockShadow }]}>
      <View style={styles.inside}>
        {color ? <>
          <View testID={`role-swatch-${role}`} style={{ height: Math.max(0, bodyHeight - height * 0.08), backgroundColor: color }}>
            <PaperTexture kind="color" tileSize={128} />
          </View>
          <View style={[styles.tints, { height: height * 0.08 }]}>
            {tints.map((tint, index) => <View key={index} style={{ flex: 1, backgroundColor: tint }} />)}
            <PaperTexture kind="color" tileSize={128} />
          </View>
        </> : <View testID={`role-empty-${role}`} style={[styles.empty, { minHeight: bodyHeight, backgroundColor: OATMEAL_STOCK }, bodyHeight < 90 && { paddingVertical: 2 }]}>
          {/* Limit mottle beneath oatmeal print to keep the measured 11.79:1. */}
          <PaperTexture opacity={0.25} />
          <View style={[styles.emptyRuling, bodyHeight < 90 && { paddingVertical: 3 }]}>
            <Text allowFontScaling style={{ fontFamily: fonts.body, fontSize: typeSize, lineHeight: typeSize * 1.15, fontStyle: 'italic', color: ink }}>
              {`No ${role} in this one. Add a color.`}
            </Text>
          </View>
        </View>}
        <View style={[styles.label, deck && { paddingLeft: labelInset, paddingTop: 3 }, { minHeight: labelHeight, backgroundColor: stock }]}>
          <PaperTexture opacity={color ? 1 : 0.25} />
          {deck && color && <Text accessible={false} style={styles.wordmark}>INZPO</Text>}
          <Text allowFontScaling style={[styles.role, deck && { letterSpacing: 0 }, { fontSize: typeSize, lineHeight: typeSize * 1.2, color: ink }]}>{role.toUpperCase()}</Text>
          {color && <Text allowFontScaling style={[styles.hex, deck && { letterSpacing: 0 }, { fontSize: typeSize, lineHeight: typeSize * 1.2, color: ink }]}>{color.toLowerCase()}</Text>}
          {deck && color && <Text accessible={false} style={styles.code}>{`IZ-${color.slice(1, 5).toLowerCase()}`}</Text>}
          {color && !deck && <Canvas style={styles.registration} accessible={false} pointerEvents="none">
            <Path path={registration!} color={INK} opacity={0.5} style="stroke" strokeWidth={0.8} transform={[{ translateX: 3 }, { translateY: 3 }]} />
            <Line p1={{ x: 4, y: 3 }} p2={{ x: 4, y: 5 }} color={INK} opacity={0.5} strokeWidth={0.6} />
          </Canvas>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 3 },
  inside: { borderRadius: 2.5, overflow: 'hidden' },
  tints: { flexDirection: 'row' },
  label: { paddingHorizontal: 4, paddingTop: 3, paddingBottom: 6 },
  role: { fontFamily: fonts.bodySemibold, letterSpacing: -0.7 },
  hex: { fontFamily: fonts.mono, letterSpacing: -0.7 },
  wordmark: { fontFamily: fonts.body, fontSize: 5, letterSpacing: 1, color: INK },
  code: { fontFamily: fonts.mono, fontSize: 5.5, marginTop: 2, color: INK },
  registration: { position: 'absolute', bottom: 3, right: 3, width: 12, height: 12 },
  empty: { justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 6 },
  emptyRuling: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#857B68', borderStyle: 'dashed', paddingVertical: 9 },
});
