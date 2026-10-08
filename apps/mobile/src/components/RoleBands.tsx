import { COLOR_ROLES, type ColorRole, type RoleColors } from '@inzpo/shared';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { contrastTextColor } from '@/lib/contrast';
import { type BandMotion } from '@/lib/useResultSequence';
import { fonts, INK, PAPER } from '@/theme/tokens';

function RoleBand({ role, color, motion }: { role: ColorRole; color: string | null; motion?: BandMotion }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: motion?.opacity.value ?? 1,
    transform: [{ translateY: motion?.translateY.value ?? 0 }],
  }));
  // PRODUCT RULE: A missing role stays empty. Never derive a replacement.
  if (color === null) {
    return (
      <Animated.View testID={`role-empty-${role}`} style={[styles.band, styles.empty, animatedStyle]}>
        <Text allowFontScaling style={styles.emptyLabel}>{`No ${role} in this one.`}</Text>
      </Animated.View>
    );
  }
  const foreground = contrastTextColor(color);
  return (
    <Animated.View testID={`role-swatch-${role}`} style={[styles.band, { backgroundColor: color }, animatedStyle]}>
      <Text allowFontScaling style={[styles.role, { color: foreground }]}>{role[0].toUpperCase() + role.slice(1)}</Text>
      <Text allowFontScaling style={[styles.hex, { color: foreground }]}>{color.toUpperCase()}</Text>
    </Animated.View>
  );
}

export function RoleBands({ roles, motion }: { roles: RoleColors; motion?: readonly BandMotion[] }) {
  return (
    <View style={styles.list}>
      {COLOR_ROLES.map((role, index) => <RoleBand key={role} role={role} color={roles[role]} motion={motion?.[index]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  band: {
    minHeight: 44, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  empty: { backgroundColor: PAPER, borderWidth: 1, borderStyle: 'dashed', borderColor: INK },
  emptyLabel: { fontFamily: fonts.body, fontSize: 14, color: INK },
  role: { fontFamily: fonts.bodyMedium, fontSize: 14, flexShrink: 1 },
  hex: { fontFamily: fonts.mono, fontSize: 14, flexShrink: 0 },
});
