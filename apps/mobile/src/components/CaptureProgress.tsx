import { useImperativeHandle, useState, type Ref } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { emptyRoles } from '@inzpo/shared';
import { KnitBaku } from '@/baku/KnitBaku';
import { usePalettePerformance } from '@/baku/usePalettePerformance';
import { resultLayout } from '@/lib/result-layout';
import type { PhotoInput } from '@/lib/upload';
import { ui } from '@/theme/styles';
import { FilmPrint } from './FilmPrint';
import { PaperTexture } from './PaperTexture';

export type CaptureProgressHandle = { readElapsed: () => number };

/** Start the host while upload and palette extraction run, then carry his clock
 * into the result. No color is claimed until the server returns real samples. */
export function CaptureProgress({ photo, ref }: { photo: PhotoInput; ref: Ref<CaptureProgressHandle> }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const layout = resultLayout({ width: width - insets.left - insets.right, height,
    topInset: insets.top, bottomInset: insets.bottom, fontScale });
  const [photoVisible, setPhotoVisible] = useState(false);
  const performance = usePalettePerformance({ kitId: 'pending-upload', ready: false, enabled: true, photoVisible, focused });
  useImperativeHandle(ref, () => ({ readElapsed: () => performance.elapsed.get() }), [performance.elapsed]);
  const heroWidth = layout.contentWidth + 40;
  const bakuWidth = Math.min(280, heroWidth * .76);
  return <SafeAreaView style={ui.screen} edges={['left', 'right', 'bottom']}>
    <PaperTexture />
    <ScrollView contentContainerStyle={{ paddingTop: Math.max(20, insets.top), paddingBottom: 32 }}>
      <View style={{ width: layout.contentWidth, alignSelf: 'center', minHeight: 86, justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={[ui.heading, { fontSize: 30, lineHeight: 32 }]}>Your colors</Text>
      </View>
      <View testID="capture-performance" style={{ width: heroWidth, alignSelf: 'center', height: layout.printHeight + bakuWidth * 2 / 3 - 100 }}>
        <FilmPrint kit={{ photo: { url: photo.uri, width: photo.width, height: photo.height, placeholder: null }, roles: emptyRoles(), colors: [] }}
          width={layout.printWidth} height={layout.printHeight} failed={false} showPins={false} onPinPress={() => {}} placeholder={null}
          onPhotoDisplay={() => setPhotoVisible(true)} onError={() => setPhotoVisible(false)} />
        <View pointerEvents="none" style={{ position: 'absolute', left: heroWidth - bakuWidth + 8, top: layout.printHeight - 100 }}>
          <KnitBaku width={bakuWidth} elapsed={performance.elapsed} readyAt={performance.readyAt} onLoaded={performance.onLoaded} />
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={[ui.body, { textAlign: 'center', marginHorizontal: 24, marginTop: 20 }]}>Keeping your photo…</Text>
    </ScrollView>
  </SafeAreaView>;
}
