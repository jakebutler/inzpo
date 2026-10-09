import { BottomSheetBackdrop, useBottomSheetSpringConfigs, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { REDUCED_SHEET_SPRING, SHEET_SPRING } from '@/theme/motion';
import { INK, PAPER } from '@/theme/tokens';

export function useSheetSpring() {
  const reducedMotion = useReducedMotion();
  return useBottomSheetSpringConfigs(reducedMotion ? REDUCED_SHEET_SPRING : SHEET_SPRING);
}

export function SaveBackdrop(props: BottomSheetBackdropProps) {
  // Dynamic sizing supplies one snap: it is also the highest snap.
  return <BottomSheetBackdrop {...props} style={[props.style, sheetStyles.backdrop]} opacity={0.35} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;
}

export function EditBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} style={[props.style, sheetStyles.backdrop]} opacity={0.35} appearsOnIndex={1} disappearsOnIndex={0} pressBehavior="close" />;
}

export const sheetStyles = StyleSheet.create({
  background: { backgroundColor: PAPER, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: INK },
  backdrop: { backgroundColor: INK },
});
