import { COLOR_ROLES, type MobileKit } from '@inzpo/shared';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetStyles, useSheetSpring } from './MotionSheet';
import { KitTools } from './KitTools';
import { ActionButton } from './ActionButton';
import { PaperTexture } from './PaperTexture';
import { ui } from '@/theme/styles';
import { OATMEAL_STOCK } from '@/theme/materials';

export function UseKitSheet({ kit, visible, onClose, descriptionFailed = false }: { kit: MobileKit; visible: boolean; onClose: () => void; descriptionFailed?: boolean }) {
  const modal = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  const [busy, setBusy] = useState(false);
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
      <Text style={ui.body}>{kit.title}</Text>
      <View accessible style={{ flexDirection: 'row', gap: 5 }} accessibilityLabel={COLOR_ROLES.map(role => `${role}: ${kit.roles[role] ?? 'empty'}`).join(', ')}>
        {COLOR_ROLES.map(role => <View key={role} style={{ flex: 1, height: 46, backgroundColor: kit.roles[role] ?? OATMEAL_STOCK,
          borderRadius: 2, borderWidth: 1, borderStyle: kit.roles[role] ? 'solid' : 'dashed', borderColor: '#857B68' }}>
          <PaperTexture kind="color" />
        </View>)}
      </View>
      <KitTools kit={kit} descriptionFailed={descriptionFailed} compact onBusyChange={setBusy} />
      <ActionButton label="Done" disabled={busy} onPress={() => modal.current?.dismiss()} />
    </BottomSheetScrollView>}
  </BottomSheetModal>;
}
