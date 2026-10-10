import { COLOR_ROLES, type MobileKit } from '@inzpo/shared';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetStyles, useSheetSpring } from './MotionSheet';
import { KitTools } from './KitTools';
import { ActionButton } from './ActionButton';
import { StockSwatch } from './StockSwatch';
import { ui } from '@/theme/styles';
import { stockSurface } from '@/theme/materials';

export function UseKitSheet({ kit, visible, onClose, descriptionFailed = false }: { kit: MobileKit; visible: boolean; onClose: () => void; descriptionFailed?: boolean }) {
  const modal = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const animationConfigs = useSheetSpring();
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior={busy ? 'none' : 'close'} opacity={.35} />, [busy]);
  // Dismissing an unpresented Gorhom modal can strand its first open in DISMISSING.
  useEffect(() => {
    if (visible) { presented.current = true; modal.current?.present(); }
    else if (presented.current) { presented.current = false; modal.current?.dismiss(); }
  }, [visible]);
  return <BottomSheetModal ref={modal} name="use-kit" snapPoints={['76%']} enableDynamicSizing={false}
    enablePanDownToClose={!busy} animationConfigs={animationConfigs}
    overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.Never}
    backgroundStyle={sheetStyles.background} handleIndicatorStyle={sheetStyles.grabber}
    backdropComponent={backdrop} onDismiss={() => { presented.current = false; setBusy(false); onClose(); }}>
    {visible && <BottomSheetScrollView contentContainerStyle={{ padding: 24, paddingBottom: Math.max(24, insets.bottom), gap: 16 }}>
      <Text accessibilityRole="header" style={ui.heading}>Use this kit</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {kit.photo && failedPhoto !== kit.photo.url && <View style={[stockSurface, { width: 54, height: 62, padding: 4, paddingBottom: 10, transform: [{ rotate: '-2deg' }] }]}>
          <Image source={{ uri: kit.photo.url }} accessibilityLabel={`Photo for ${kit.title}`} contentFit="cover"
            onError={() => setFailedPhoto(kit.photo!.url)} style={{ width: '100%', height: '100%' }} />
        </View>}
        <Text style={[ui.headerTitle, { flex: 1 }]}>{kit.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {COLOR_ROLES.map(role => <View key={role} accessible accessibilityLabel={`${role}: ${kit.roles[role] ?? 'No color yet'}`}
          style={{ flexBasis: '30%', flexGrow: 1, minHeight: 60 }}>
          <StockSwatch color={kit.roles[role]} label={role} />
        </View>)}
      </View>
      <KitTools kit={kit} descriptionFailed={descriptionFailed} compact onBusyChange={setBusy} />
      <ActionButton label="Done" disabled={busy} onPress={() => modal.current?.dismiss()} />
    </BottomSheetScrollView>}
  </BottomSheetModal>;
}
