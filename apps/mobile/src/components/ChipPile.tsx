import { COLOR_ROLES, type ColorRole, type RoleColors } from '@inzpo/shared';
import { Pressable, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ChipSlot } from '@/lib/result-layout';
import type { PalettePerformance } from '@/baku/usePalettePerformance';
import { anticipationAt, clamp, deform, poseAt, SNOUT, TIMING } from '@/baku/motion';
import type { BandMotion } from '@/lib/useResultSequence';
import { PaintChip } from './PaintChip';

function PileCard({ slot, color, typeSize, motion, disabled, onPress, selected, expanded, performance, emitter, index }: {
  performance?: PalettePerformance; emitter?: { x: number; y: number; width: number }; index: number;
  slot: ChipSlot; color: string | null; typeSize: number; motion?: BandMotion; disabled: boolean; onPress: (role: ColorRole) => void; selected: boolean; expanded: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(reducedMotion ? 0 : withTiming(selected ? -6 : 0, { duration: 120 }));
    return () => cancelAnimation(lift);
  }, [selected, reducedMotion, lift]);
  const animatedStyle = useAnimatedStyle(() => {
    if (performance && emitter && !performance.finished && !reducedMotion) {
      const readyAt = performance.readyAt.value;
      const release = anticipationAt(Math.max(0, readyAt)) + TIMING.anticipation + index * .045;
      const progress = readyAt < 0 ? 0 : clamp((performance.elapsed.value - release) / .70);
      const ease = 1 - Math.pow(1 - progress, 3);
      const point = deform(SNOUT.x, SNOUT.y, poseAt(release + .085, Math.max(0, readyAt)));
      const dx = emitter.x + point.x * emitter.width - slot.x - slot.width / 2;
      const dy = emitter.y + point.y * emitter.width * 2 / 3 - slot.y - slot.height / 2;
      // Empty roles arrive as blank stock, never as fabricated colored swatches.
      return { opacity: color ? (progress > 0 ? 1 : 0) : clamp((progress - .7) / .3), transform: [
        { translateX: color ? dx * (1 - ease) : 0 },
        { translateY: color ? dy * (1 - ease) - Math.sin(progress * Math.PI) * 60 : 0 },
        { scale: color ? .07 + .93 * ease : 1 },
        { rotate: `${slot.rotation + (color ? (index % 2 ? -65 : 80) * (1 - ease) : 0)}deg` },
      ] };
    }
    return { opacity: motion?.opacity.value ?? 1,
      transform: [{ translateY: (motion?.translateY.value ?? 0) + lift.value }, { rotate: `${slot.rotation}deg` }] };
  });
  return <Animated.View testID={`chip-slot-${slot.role}`} style={[{
    position: 'absolute', left: slot.x, top: slot.y, width: slot.width, minHeight: slot.height, zIndex: selected ? 20 : slot.zIndex,
  }, animatedStyle]}>
    <Pressable testID={`flip-chip-${slot.role}`} accessibilityRole="button" accessibilityState={{ disabled, expanded }} disabled={disabled}
      accessibilityLabel={color ? `${slot.role}: ${color}. Show color detail.` : `${slot.role}: No ${slot.role} in this one. Add a color.`}
      onPress={() => onPress(slot.role)} style={{ minHeight: 44, minWidth: 44 }}>
      <PaintChip role={slot.role} color={color} width={slot.width} height={slot.height} typeSize={typeSize} lifted={selected} />
    </Pressable>
  </Animated.View>;
}

export function ChipPile({ roles, slots, height, typeSize, motion, disabled, onPress, selectedRole, expandedRole, performance, emitter }: {
  performance?: PalettePerformance; emitter?: { x: number; y: number; width: number };
  roles: RoleColors; slots: ChipSlot[]; height: number; typeSize: number;
  motion?: readonly BandMotion[]; disabled: boolean; onPress: (role: ColorRole) => void;
  selectedRole?: ColorRole | null; expandedRole?: ColorRole | null;
}) {
  return <View testID="chip-pile" style={{ height, zIndex: 11 }}>
    {COLOR_ROLES.map((role, index) => <PileCard key={role} slot={slots[index]} color={roles[role]} typeSize={typeSize}
      performance={performance} emitter={emitter} index={index} motion={motion?.[index]} disabled={disabled} onPress={onPress} selected={selectedRole === role} expanded={expandedRole === role} />)}
  </View>;
}
