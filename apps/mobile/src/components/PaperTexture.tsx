import { Canvas, Fill, ImageShader, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

const textures = {
  paper: require('../../assets/materials/paper-grain.png'),
  color: require('../../assets/materials/color-grain.png'),
};

/** Repeat the original quiet fibers at their CSS size; don't stretch them. */
export function PaperTexture({ kind = 'paper', tileSize = 512, opacity = 1 }: {
  kind?: keyof typeof textures; tileSize?: number; opacity?: number;
}) {
  const texture = useImage(textures[kind]);
  if (!texture) return null;
  return (
    <Canvas pointerEvents="none" accessible={false} style={StyleSheet.flatten([StyleSheet.absoluteFill, { mixBlendMode: 'multiply', opacity }])}>
      <Fill>
        <ImageShader image={texture} tx="repeat" ty="repeat" fit="fill" rect={{ x: 0, y: 0, width: tileSize, height: tileSize }} />
      </Fill>
    </Canvas>
  );
}
