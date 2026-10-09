export type Point = { x: number; y: number };
export type FrameRect = Point & { width: number; height: number };
export type ClipName = 'inhale' | 'chewLoop' | 'chewVariation' | 'sneeze';
export type HapticKind = 'soft' | 'light' | 'medium' | 'heavy' | 'rigid';
export type MunchManifest = {
  kind: 'STAND-IN';
  fps: number;
  frameSize: { width: number; height: number };
  densities: number[];
  pageCount: number;
  clips: Record<ClipName, { start: number; count: number; loop: boolean }>;
  hapticFrames: Record<ClipName, { frame: number; kind: HapticKind }[]>;
  frames: { page: number; rect: FrameRect; snoutAnchor: Point; bellyAnchor: Point }[];
};
export type Stage = 'idle' | 'inhale' | 'chew' | 'sneeze' | 'landed';
export type Playback = { stage: Stage; elapsed: number; sneezeAt: number };
export type FrameSample = { clip: ClipName; frame: number; localFrame: number; cycle: number };
