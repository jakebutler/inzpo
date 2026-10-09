import type { MobileKit } from '@inzpo/shared';
import { BottomSheetModal, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { SaveBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';
import { SaveSheetContent, type SavedCollection } from './SaveSheetContent';

export function SaveSheet({ visible, kitId, kit, onClose, onSaved, onSaveError }: {
  visible: boolean; kitId: string; kit?: MobileKit; onClose: () => void; onSaved?: (collection: SavedCollection) => void; onSaveError?: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const [saving, setSaving] = useState(false);
  const backdrop = useCallback((props: BottomSheetBackdropProps) =>
    cloneElement(SaveBackdrop(props), { pressBehavior: saving ? 'none' : 'close' }), [saving]);
  const { height } = useWindowDimensions();
  const animationConfigs = useSheetSpring();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (visible) modal.current?.present();
    else modal.current?.dismiss();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={modal}
      name="save-kit"
      enableDynamicSizing={false}
      snapPoints={[height]}
      handleComponent={null}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableBlurKeyboardOnGesture
      enablePanDownToClose={!saving}
      animationConfigs={animationConfigs}
      overrideReduceMotion={reducedMotion ? ReduceMotion.Always : ReduceMotion.Never}
      backgroundStyle={sheetStyles.background}
      handleIndicatorStyle={sheetStyles.grabber}
      backdropComponent={backdrop}
      onDismiss={() => { setSaving(false); onClose(); }}
    >
      {visible && <SaveSheetContent key={kitId} kitId={kitId} kit={kit} onClose={() => modal.current?.dismiss()} onSaved={onSaved} onSaveError={onSaveError} onSavingChange={setSaving} />}
    </BottomSheetModal>
  );
}
