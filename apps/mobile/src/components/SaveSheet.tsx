import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { SaveBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';
import { SaveSheetContent } from './SaveSheetContent';

export function SaveSheet({ visible, kitId, onClose }: { visible: boolean; kitId: string; onClose: () => void }) {
  const modal = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();
  const animationConfigs = useSheetSpring();
  useEffect(() => {
    if (visible) modal.current?.present();
    else modal.current?.dismiss();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={modal}
      name="save-kit"
      enableDynamicSizing
      maxDynamicContentSize={height * 0.6}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableBlurKeyboardOnGesture
      enablePanDownToClose
      animationConfigs={animationConfigs}
      overrideReduceMotion={ReduceMotion.Never}
      backgroundStyle={sheetStyles.background}
      handleIndicatorStyle={sheetStyles.grabber}
      backdropComponent={SaveBackdrop}
      onDismiss={onClose}
    >
      {visible && <SaveSheetContent key={kitId} kitId={kitId} onClose={() => modal.current?.dismiss()} />}
    </BottomSheetModal>
  );
}
