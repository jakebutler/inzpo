import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { inkIcons } from '@/theme/ink-icons';

export function InkIcon({ name, size = 24 }: { name: keyof typeof inkIcons; size?: number }) {
  const paths = useMemo(() => inkIcons[name].map((path) => ({ ...path, skiaPath: Skia.Path.MakeFromSVGString(path.d)! })), [name]);
  return <Canvas pointerEvents="none" accessible={false} style={{ width: size, height: size }}>
    <Group transform={[{ scale: size / 24 }]}>
      {paths.map((path, index) => <Group key={index} opacity={path.opacity}>
        {path.fill !== 'none' && <Path path={path.skiaPath} color={path.fill} />}
        {path.stroke !== 'none' && <Path path={path.skiaPath} color={path.stroke} style="stroke"
          strokeWidth={path.strokeWidth} strokeCap="round" strokeJoin="round" />}
      </Group>)}
    </Group>
  </Canvas>;
}
