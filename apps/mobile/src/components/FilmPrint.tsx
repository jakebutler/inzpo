import type { ColorRole, MobileKit } from '@inzpo/shared';
import { Canvas, Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import type { ViewProps } from 'react-native';
import { photoPins } from '@/lib/result-pins';
import { LABEL_STOCK, stockSurface } from '@/theme/materials';
import { fonts, INK, VERMILION } from '@/theme/tokens';

export const pinRing = Skia.Path.MakeFromSVGString('M4 -6 C-2 -10 -8 -5 -7 1 C-7 7 1 9 6 5 C9 2 8 -3 6 -5')!;

export function FilmPrint({ kit, width, height, failed, onError, placeholder, markerStyle, selectedRole, onPinPress, interactive = true, showPins = true, onPhotoDisplay, preview, date, photoPosition = 'top', borderInset = 12, foot = 36, pinHeight }: {
  kit: Pick<MobileKit, 'photo' | 'roles' | 'colors'>; width: number; height: number; failed: boolean; onError: () => void; placeholder: ReactNode;
  markerStyle?: AnimatedProps<ViewProps>['style']; selectedRole?: ColorRole | null; onPinPress: (role: ColorRole) => void;
  onPhotoDisplay?: () => void; preview?: string;
  interactive?: boolean; showPins?: boolean; date?: string; photoPosition?: React.ComponentProps<typeof Image>['contentPosition'];
  borderInset?: number; foot?: number;
  pinHeight?: number;
}) {
  const photoWidth = width - 2 * (borderInset + 1);
  const photoHeight = height - borderInset - foot - 2;
  const pins = photoPins(kit, photoWidth, photoHeight, pinHeight);
  return (
    <View testID="film-print" style={[stockSurface, styles.print, { width, height, paddingTop: borderInset, paddingHorizontal: borderInset, paddingBottom: foot }]}>
      <View style={[styles.photo, { width: photoWidth, height: photoHeight }]}>
        {kit.photo && !failed ? <>
          <Image key={kit.photo.url} source={{ uri: kit.photo.url }} placeholder={preview ? { uri: preview } : kit.photo.placeholder ?? undefined}
            placeholderContentFit="cover" onDisplay={onPhotoDisplay}
            contentFit="cover" contentPosition={photoPosition} accessibilityLabel="Source photo" onError={onError} style={StyleSheet.absoluteFill} />
          <Canvas testID="film-sheen" accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* A single fixed, broad, feathered ellipse bowed across the top-left.
                Peak white is 10%; the glint fades along the top edge. */}
            <Group origin={{ x: photoWidth / 2, y: photoHeight / 2 }} transform={[{ rotate: 24 * Math.PI / 180 }]}>
            <Group origin={{ x: photoWidth * 0.276, y: photoHeight * 0.276 }} transform={[{ scaleX: photoWidth * 0.416 / (photoHeight * 0.91) }]}>
              <Rect x={-photoWidth} y={-photoHeight} width={photoWidth * 3} height={photoHeight * 3}>
                <RadialGradient c={{ x: photoWidth * 0.276, y: photoHeight * 0.276 }} r={photoHeight * 0.91}
                  colors={['#FFFFFF1A', '#FFFFFF13', '#FFFFFF08', '#FFFFFF00']} positions={[0, 0.3, 0.53, 0.76]} />
              </Rect>
            </Group>
            </Group>
            <Rect x={photoWidth * 0.04} y={0} width={photoWidth * 0.92} height={1}>
              <LinearGradient start={{ x: 0, y: 0 }} end={{ x: photoWidth, y: 0 }}
                colors={['#FFFFFF00', '#FFFFFF70', '#FFFFFF70', '#FFFFFF00']} positions={[0, 0.25, 0.65, 1]} />
            </Rect>
          </Canvas>
          {showPins && <Animated.View testID="photo-pins" style={[StyleSheet.absoluteFill, markerStyle]}>
            <Canvas accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {pins.map(({ role, marker, target, color }) => <Group key={role}>
                <Path path={Skia.Path.MakeFromSVGString(`M${target.x} ${target.y} Q${(target.x + marker.x) / 2 - 1} ${(target.y + marker.y) / 2} ${marker.x} ${marker.y}`)!}
                  style="stroke" strokeWidth={2.5} color={LABEL_STOCK} />
                <Path path={Skia.Path.MakeFromSVGString(`M${target.x} ${target.y} Q${(target.x + marker.x) / 2 - 1} ${(target.y + marker.y) / 2} ${marker.x} ${marker.y}`)!}
                  style="stroke" strokeWidth={1} color={INK} strokeCap="round" />
                <Group transform={[{ translateX: marker.x }, { translateY: marker.y }, { scale: selectedRole === role ? 0.92 : 0.8 }]}>
                  <Path path={pinRing} color={LABEL_STOCK} style="stroke" strokeWidth={5} strokeCap="round" />
                  <Path path={pinRing} color={selectedRole === role ? VERMILION : INK} style="stroke" strokeWidth={2.5} strokeCap="round" />
                </Group>
                <Circle cx={marker.x} cy={marker.y} r={3.7} color={LABEL_STOCK} />
                <Circle cx={marker.x} cy={marker.y} r={3} color={color} />
              </Group>)}
            </Canvas>
            {pins.map(({ role, marker }) => <Pressable key={role} testID={`photo-pin-${role}`} accessibilityRole="button"
              accessibilityState={{ disabled: !interactive }} disabled={!interactive} accessibilityLabel={`Edit ${role} photo sample`} onPress={() => onPinPress(role)}
              style={{ position: 'absolute', left: marker.x - 22, top: marker.y - 22, width: 44, height: 44 }} />)}
          </Animated.View>}
        </> : placeholder}
      </View>
      {date && <Text allowFontScaling style={styles.date}>{date}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  print: { borderWidth: 1, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 36, alignSelf: 'center' },
  photo: { position: 'relative', overflow: 'hidden' },
  date: { position: 'absolute', right: 12, bottom: 3, fontFamily: fonts.hand, fontSize: 23, color: INK },
});
