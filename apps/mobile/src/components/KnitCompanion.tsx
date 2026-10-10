import type { RoleColors } from '@inzpo/shared';
import { Image } from 'expo-image';
import { useSharedValue } from 'react-native-reanimated';
import { KnitBaku } from '@/baku/KnitBaku';
import { hostDurationFor } from '@/baku/host-motion';

/** The same character at rest; no perpetual decoration loop or invented coat colors. */
export function KnitCompanion({ width = 150, roles }: { width?: number; roles?: RoleColors }) {
  const elapsed = useSharedValue(hostDurationFor(0));
  const readyAt = useSharedValue(0);
  return roles ? <KnitBaku width={width} elapsed={elapsed} readyAt={readyAt} roles={roles} />
    : <Image source={require('../../assets/baku-performance/neutral-monotone.webp')} contentFit="contain" accessible={false}
      style={{ width, height: width * 2 / 3 }} />;
}
