import { Image } from 'expo-image';

const poses = {
  idle: require('../../assets/baku/baku-idle-color.png'),
  chewing: require('../../assets/baku/baku-chewing-color.png'),
  success: require('../../assets/baku/baku-success-color.png'),
  errorBrief: require('../../assets/baku/baku-error-brief-color.png'),
  errorPhoto: require('../../assets/baku/baku-error-photo-color.png'),
  empty: require('../../assets/baku/baku-empty-color.png'),
  notFound: require('../../assets/baku/baku-404-color.png'),
} as const;

export type BakuPose = keyof typeof poses;

export function Baku({ pose = 'idle', size = 96 }: { pose?: BakuPose; size?: number }) {
  // TODO: Stripe tinting (Skia/Rive; empty band = oatmeal #E4D9C6)
  // waits for Designer's rebuilt masks. Keep these color PNGs untinted.
  return (
    <Image
      source={poses[pose]}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessible={false}
      testID={`baku-${pose}`}
    />
  );
}
