import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { contrastTextColor } from '@/lib/contrast';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';
import { EditBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';

const SNAP_POINTS = [156, '64%'];
export type EditSheetHandle = { snapToPeek: () => void };

export const EditSheet = forwardRef<EditSheetHandle, { visible: boolean; roles: RoleColors; onClose: () => void }>(
  function EditSheet({ visible, roles, onClose }, ref) {
    const modal = useRef<BottomSheetModal>(null);
    const [index, setIndex] = useState(0);
    const animationConfigs = useSheetSpring();
    useImperativeHandle(ref, () => ({ snapToPeek: () => modal.current?.snapToIndex(0) }), []);
    useEffect(() => {
      if (visible) { setIndex(0); modal.current?.present(); }
      else modal.current?.dismiss();
    }, [visible]);

    return (
      <BottomSheetModal
        ref={modal}
        name="edit-kit"
        index={0}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        enablePanDownToClose
        animationConfigs={animationConfigs}
        overrideReduceMotion={ReduceMotion.Never}
        backgroundStyle={sheetStyles.background}
        handleIndicatorStyle={sheetStyles.grabber}
        backdropComponent={EditBackdrop}
        onChange={setIndex}
        onDismiss={onClose}
      >
        {visible && (
          <BottomSheetView style={styles.content}>
            <View style={styles.chips}>
              {COLOR_ROLES.map((role) => {
                const color = roles[role];
                return (
                  <View key={role} testID={`edit-role-${role}`} accessibilityLabel={color ? `${role}: ${color}` : `No ${role} in this one.`}
                    style={[styles.chip, color === null ? styles.empty : { backgroundColor: color }]}>
                    <Text allowFontScaling style={[styles.role, { color: color === null ? INK : contrastTextColor(color) }]}>{role}</Text>
                  </View>
                );
              })}
            </View>
            {index === 1 && (
              <View style={styles.placeholder}>
                {/* TODO(motion): Loupe + actual color editing; quantized selection ticks. */}
                <Text allowFontScaling style={ui.message}>Color picking comes next</Text>
              </View>
            )}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexBasis: '30%', flexGrow: 1, minHeight: 44, padding: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: PAPER, borderWidth: 1, borderColor: INK, borderStyle: 'dashed' },
  role: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  placeholder: { minHeight: 180, borderWidth: 1, borderColor: INK, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', padding: 20 },
});
