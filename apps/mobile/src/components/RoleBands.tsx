import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';
import { StyleSheet, Text, View } from 'react-native';
import { contrastTextColor } from '@/lib/contrast';
import { fonts, INK, PAPER } from '@/theme/tokens';

export function RoleBands({ roles }: { roles: RoleColors }) {
  return (
    <View style={styles.list}>
      {COLOR_ROLES.map((role) => {
        const color = roles[role];
        // PRODUCT RULE: A missing role stays empty. Never derive a replacement.
        if (color === null) {
          return (
            <View key={role} testID={`role-empty-${role}`} style={[styles.band, styles.empty]}>
              <Text style={styles.emptyLabel}>{`No ${role} in this one.`}</Text>
            </View>
          );
        }
        const foreground = contrastTextColor(color);
        return (
          <View key={role} testID={`role-swatch-${role}`} style={[styles.band, { backgroundColor: color }]}>
            <Text style={[styles.role, { color: foreground }]}>{role[0].toUpperCase() + role.slice(1)}</Text>
            <Text style={[styles.hex, { color: foreground }]}>{color.toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  band: {
    minHeight: 48, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  empty: { backgroundColor: PAPER, borderWidth: 1, borderStyle: 'dashed', borderColor: INK },
  emptyLabel: { fontFamily: fonts.body, fontSize: 14, color: INK },
  role: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  hex: { fontFamily: fonts.mono, fontSize: 14 },
});
