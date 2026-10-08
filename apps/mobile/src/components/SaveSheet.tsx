import { BottomSheetModal, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { SaveBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';
import { SaveSheetContent, type SavedCollection } from './SaveSheetContent';

export function SaveSheet({ visible, kitId, onClose, onSaved, onSaveError }: {
  visible: boolean; kitId: string; onClose: () => void; onSaved?: (collection: SavedCollection) => void; onSaveError?: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const [saving, setSaving] = useState(false);
  const backdrop = useCallback((props: BottomSheetBackdropProps) =>
    cloneElement(SaveBackdrop(props), { pressBehavior: saving ? 'none' : 'close' }), [saving]);
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
      enablePanDownToClose={!saving}
      animationConfigs={animationConfigs}
      overrideReduceMotion={ReduceMotion.Never}
      backgroundStyle={sheetStyles.background}
      handleIndicatorStyle={sheetStyles.grabber}
      backdropComponent={backdrop}
      onDismiss={() => { setSaving(false); onClose(); }}
    >
      {visible && <SaveSheetContent key={kitId} kitId={kitId} onClose={() => modal.current?.dismiss()} onSaved={onSaved} onSaveError={onSaveError} onSavingChange={setSaving} />}
    </BottomSheetModal>
  );
}
