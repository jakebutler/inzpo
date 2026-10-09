import { COLOR_ROLES, type ColorRole, type RoleColors } from '@inzpo/shared';
import { Pressable, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ChipSlot } from '@/lib/result-layout';
import type { BandMotion } from '@/lib/useResultSequence';
import { PaintChip } from './PaintChip';

function PileCard({ slot, color, typeSize, motion, disabled, onPress, selected, expanded }: {
  slot: ChipSlot; color: string | null; typeSize: number; motion?: BandMotion; disabled: boolean; onPress: (role: ColorRole) => void; selected: boolean; expanded: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(reducedMotion ? 0 : withTiming(selected ? -6 : 0, { duration: 120 }));
    return () => cancelAnimation(lift);
  }, [selected, reducedMotion, lift]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: motion?.opacity.value ?? 1,
    transform: [{ translateY: (motion?.translateY.value ?? 0) + lift.value }, { rotate: `${slot.rotation}deg` }],
  }));
  return <Animated.View testID={`chip-slot-${slot.role}`} style={[{
    position: 'absolute', left: slot.x, top: slot.y, width: slot.width, minHeight: slot.height, zIndex: selected ? 20 : slot.zIndex,
  }, animatedStyle]}>
    <Pressable testID={`flip-chip-${slot.role}`} accessibilityRole="button" accessibilityState={{ disabled, expanded }} disabled={disabled}
      accessibilityLabel={color ? `${slot.role}: ${color}. Show color detail.` : `${slot.role}: No color yet. Add a color.`}
      onPress={() => onPress(slot.role)} style={{ minHeight: 44, minWidth: 44 }}>
      <PaintChip role={slot.role} color={color} width={slot.width} height={slot.height} typeSize={typeSize} lifted={selected} />
    </Pressable>
  </Animated.View>;
}

export function ChipPile({ roles, slots, height, typeSize, motion, disabled, onPress, selectedRole, expandedRole }: {
  roles: RoleColors; slots: ChipSlot[]; height: number; typeSize: number;
  motion?: readonly BandMotion[]; disabled: boolean; onPress: (role: ColorRole) => void;
  selectedRole?: ColorRole | null; expandedRole?: ColorRole | null;
}) {
  return <View testID="chip-pile" style={{ height, zIndex: 11 }}>
    {COLOR_ROLES.map((role, index) => <PileCard key={role} slot={slots[index]} color={roles[role]} typeSize={typeSize}
      motion={motion?.[index]} disabled={disabled} onPress={onPress} selected={selectedRole === role} expanded={expandedRole === role} />)}
  </View>;
}
