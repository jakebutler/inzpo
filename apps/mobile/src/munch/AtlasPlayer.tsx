import {
  Atlas, BlendColor, Canvas, Circle, Group, Image as SkiaImage, ImageShader,
  Rect, RoundedRect, Shader, Skia, useImage,
  type SkImage,
} from '@shopify/react-native-skia';
import { COLOR_ROLES } from '@inzpo/shared';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Text, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { atlasDensity, atlasSources, stripeSources, testPhoto } from './assets';
import { munchManifest } from './manifest';
import { STRIPE_MASK_SKSL } from './stripe';
import {
  advancePlayback, chipPosition, chipProgress, droppedFrames, hapticBetween,
  initialPlayback, LANDING_MS, sampleFrame,
} from './sequence';
import type { Playback, Point } from './types';

export const LAB_ROLES = COLOR_ROLES.slice(0, 5);
export const LAB_KITS = [
  ['#B35831', '#6D8C75', '#DCA54C', '#F3EEE4', '#92B1BC', '#332D28'],
  ['#6756A3', '#DC8971', '#B1C66C', '#ECE0EF', '#87A7D3', '#393447'],
];
const WIDTH = munchManifest.frameSize.width;
const HEIGHT = munchManifest.frameSize.height;
const DENSITY = atlasDensity;
const PARTICLES = Array.from({ length: 30 }, (_, i) => i);
const PAGE_IDS = [0, 1, 2, 3];

// Modulate preserves felt luminance while applying each live kit color.
const stripeEffect = Skia.RuntimeEffect.Make(STRIPE_MASK_SKSL);

export type LabController = { start: (seconds: number) => void; skip: () => void; ready: boolean };
type Props = { width: number; kit: string[]; onController: (controller: LabController) => void };

function Stripe({ mask, state, band, color }: {
  mask: SkImage; state: SharedValue<Playback>; band: number; color: string;
}) {
  const uniforms = useDerivedValue(() => {
    const f = munchManifest.frames[sampleFrame(state.get()).frame];
    return { offset: [f.rect.x * DENSITY, f.rect.y * DENSITY], band };
  });
  return (
    <Rect x={0} y={0} width={WIDTH * DENSITY} height={HEIGHT * DENSITY}>
      <Shader source={stripeEffect!} uniforms={uniforms}>
        <ImageShader image={mask} fit="none" tx="clamp" ty="clamp" />
      </Shader>
      <BlendColor color={color} mode="modulate" />
    </Rect>
  );
}

function AtlasPage({ image, mask, page, state, position, kit }: {
  image: SkImage; mask: SkImage; page: number; state: SharedValue<Playback>; position: Point; kit: string[];
}) {
  const sprites = useDerivedValue(() => {
    const f = munchManifest.frames[sampleFrame(state.get()).frame];
    return [{ x: f.rect.x * DENSITY, y: f.rect.y * DENSITY, width: WIDTH * DENSITY, height: HEIGHT * DENSITY }];
  });
  const opacity = useDerivedValue(() => munchManifest.frames[sampleFrame(state.get()).frame].page === page ? 1 : 0);
  const transforms = useMemo(() => [Skia.RSXform(1, 0, 0, 0)], []);
  return (
    <Group opacity={opacity} transform={[{ translateX: position.x }, { translateY: position.y }, { scale: 1 / DENSITY }]}>
      <Atlas image={image} sprites={sprites} transforms={transforms} />
      {kit.map((color, i) => <Stripe key={i} band={i + 1} color={color} mask={mask} state={state} />)}
    </Group>
  );
}

function Essence({ id, color, state, from, baku, reduced }: {
  id: number; color: string; state: SharedValue<Playback>; from: Point; baku: Point; reduced: SharedValue<boolean>;
}) {
  const position = useDerivedValue(() => {
    const s = state.get();
    const anchor = munchManifest.frames[sampleFrame(s).frame].snoutAnchor;
    const p = ((s.elapsed + (id % 6) * 87) % 520) / 520;
    const curve = Math.sin(Math.PI * p) * (id % 2 === 0 ? 18 : -18);
    return { x: from.x + (baku.x + anchor.x - from.x) * p,
      y: from.y + (baku.y + anchor.y - from.y) * p + curve };
  });
  const opacity = useDerivedValue(() => state.get().stage === 'inhale' && !reduced.get()
    ? Math.sin(Math.PI * (((state.get().elapsed + (id % 6) * 87) % 520) / 520)) * .8 : 0);
  return <Circle c={position} r={2 + (id % 3) * .6} color={color} opacity={opacity} />;
}

export function AtlasPlayer({ width, kit, onController }: Props) {
  const [error, setError] = useState<string | null>(null);
  const imageError = useCallback(() => setError('Atlas decode failed. Reopen the lab to retry.'), []);
  // useImage returns only after Skia has decoded each asset; all pages and masks
  // stay resident throughout a run. No network fetch or image decode in playback.
  const a0 = useImage(atlasSources[0], imageError);
  const a1 = useImage(atlasSources[1], imageError);
  const a2 = useImage(atlasSources[2], imageError);
  const a3 = useImage(atlasSources[3], imageError);
  const m0 = useImage(stripeSources[0], imageError);
  const m1 = useImage(stripeSources[1], imageError);
  const m2 = useImage(stripeSources[2], imageError);
  const m3 = useImage(stripeSources[3], imageError);
  const photo = useImage(testPhoto, imageError);
  const decoded = Boolean(a0 && a1 && a2 && a3 && m0 && m1 && m2 && m3 && photo && stripeEffect);
  const images = [a0, a1, a2, a3];
  const masks = [m0, m1, m2, m3];
  const state = useSharedValue<Playback>(initialPlayback());
  const reduced = useSharedValue(true);
  const hasAccessibility = useSharedValue(false);
  const loaded = useSharedValue(false);
  const warmFrames = useSharedValue(0);
  const resumeFrame = useSharedValue(false);
  const active = useSharedValue(false);
  const frames = useSharedValue(0);
  const windowMs = useSharedValue(0);
  const drops = useSharedValue(0);
  const pendingSkip = useSharedValue(false);
  const sneezeOrigin = useSharedValue<Point>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [telemetry, setTelemetry] = useState({ fps: 0, drops: 0, stage: 'idle' });
  const generation = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extractionResolved = useSharedValue(false);
  const baku = useMemo(() => ({ x: (width - WIDTH) / 2, y: 186 }), [width]);
  const slots = useMemo(() => LAB_ROLES.map((_, i) => ({ x: (width - 240) / 2 + 24 + i * 48, y: 380 })), [width]);
  const samples = useMemo(() => [
    { x: width * .25, y: 60 }, { x: width * .55, y: 80 }, { x: width * .75, y: 110 },
    { x: width * .35, y: 135 }, { x: width * .65, y: 145 },
  ], [width]);
  const publish = useCallback((fps: number, count: number, stage: string) => {
    if (mounted.current) setTelemetry({ fps, drops: count, stage });
  }, []);
  const markReady = useCallback(() => { if (mounted.current) setReady(true); }, []);
  const fireHaptic = useCallback((kind: string, run: number, emittedAt: number) => {
    if (!mounted.current || run !== generation.current || !active.get() || reduced.get()
      || AppState.currentState !== 'active' || Date.now() - emittedAt > 100) return;
    const styles = { soft: Haptics.ImpactFeedbackStyle.Soft, light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy, rigid: Haptics.ImpactFeedbackStyle.Rigid };
    void Haptics.impactAsync(styles[kind as keyof typeof styles]).catch(() => undefined);
  }, [active, reduced]);
  const runId = useSharedValue(0);

  useEffect(() => { loaded.set(decoded); }, [decoded, loaded]);
  useEffect(() => {
    let disposed = false;
    let changed = false;
    const update = (value: boolean) => { reduced.set(value); hasAccessibility.set(true); };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { changed = true; update(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!disposed && !changed) update(value);
    }).catch(() => { if (!disposed) update(true); });
    return () => { disposed = true; subscription.remove(); };
  }, [reduced, hasAccessibility]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      loaded.set(false);
    };
  }, [loaded]);

  const clock = useFrameCallback(useCallback(({ timeSincePreviousFrame }: { timeSincePreviousFrame: number | null }) => {
    'worklet';
    if (!loaded.get() || !hasAccessibility.get() || !active.get()) return;
    if (warmFrames.get() < 3) {
      warmFrames.set(warmFrames.get() + 1);
      if (warmFrames.get() === 3) scheduleOnRN(markReady);
      return;
    }
    const previous = state.get();
    if (previous.stage === 'idle' || previous.stage === 'landed') return;
    const delta = resumeFrame.get() ? 0 : timeSincePreviousFrame ?? 0;
    resumeFrame.set(false);
    const next = advancePlayback(previous, delta, extractionResolved.get(), pendingSkip.get());
    pendingSkip.set(false);
    if (next.stage === 'sneeze' && next.elapsed - next.sneezeAt >= 50
      && (previous.stage !== 'sneeze' || previous.elapsed - previous.sneezeAt < 50)) {
      const anchor = munchManifest.frames[sampleFrame(next).frame].snoutAnchor;
      sneezeOrigin.set({ x: baku.x + anchor.x, y: baku.y + anchor.y });
    }
    const haptic = hapticBetween(sampleFrame(previous), sampleFrame(next));
    // Haptics are sparse JS/native events. Animation never waits for them.
    if (next.stage !== 'landed' && !reduced.get() && haptic) scheduleOnRN(fireHaptic, haptic, runId.get(), Date.now());
    state.set(next);
    if (delta > 0) frames.set(frames.get() + 1);
    windowMs.set(windowMs.get() + delta);
    drops.set(drops.get() + droppedFrames(delta, previous.elapsed));
    if (windowMs.get() >= 500 || next.stage === 'landed') {
      scheduleOnRN(publish, Math.round(frames.get() * 1000 / Math.max(1, windowMs.get())), drops.get(), next.stage);
      frames.set(0); windowMs.set(0);
    }
  }, [loaded, hasAccessibility, active, warmFrames, markReady, state, resumeFrame,
    extractionResolved, pendingSkip, sneezeOrigin, baku, reduced, fireHaptic, runId,
    frames, windowMs, drops, publish]), false);
  useFocusEffect(useCallback(() => {
    const update = (value: string | null) => {
      resumeFrame.set(true);
      active.set(value === 'active');
      clock.setActive(value === 'active');
    };
    update(AppState.currentState);
    const app = AppState.addEventListener('change', update);
    return () => {
      app.remove();
      active.set(false);
      resumeFrame.set(true);
      clock.setActive(false);
    };
  }, [clock, active, resumeFrame]));

  const start = useCallback((seconds: number) => {
    if (!ready) return;
    const run = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    scheduleOnUI(() => {
      'worklet';
      extractionResolved.set(false);
      pendingSkip.set(false);
      runId.set(run);
      resumeFrame.set(true);
      drops.set(0); frames.set(0); windowMs.set(0);
      state.set({ stage: 'inhale', elapsed: 0, sneezeAt: -1 });
      if (!reduced.get()) scheduleOnRN(fireHaptic, 'soft', run, Date.now());
    });
    // A real Promise models an extraction, independent of the UI frame clock.
    void new Promise<void>((resolve) => { timer.current = setTimeout(resolve, Math.max(0, seconds) * 1000); }).then(() => {
      if (mounted.current && generation.current === run) extractionResolved.set(true);
    });
  }, [ready, extractionResolved, pendingSkip, runId, resumeFrame, drops, frames, windowMs, state, reduced, fireHaptic]);
  const skip = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    pendingSkip.set(true);
  }, [pendingSkip]);
  useEffect(() => { onController({ start, skip, ready }); }, [start, skip, ready, onController]);

  // Submit every texture on the initial draw and allow three UI frames before
  // enabling Start. The tiny warmup draws sit beside the photo.
  return (
    <View>
      <Canvas style={{ width, height: 408 }} accessible={false} colorSpace="srgb">
        {decoded && <>
          {PAGE_IDS.map((page) => <Group key={`warm-${page}`}>
            <SkiaImage image={images[page]} x={12} y={12} width={1} height={1} fit="fill" />
            <SkiaImage image={masks[page]} x={12} y={12} width={1} height={1} fit="fill" />
          </Group>)}
          <RoundedRect x={16} y={12} width={width - 32} height={150} r={12} color="#E4D9C6" />
          <Group clip={{ x: 16, y: 12, width: width - 32, height: 150 }}>
            <SkiaImage image={photo} x={16} y={12} width={width - 32} height={150} fit="cover" />
          </Group>
          {samples.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4} color={kit[i]} />)}
          {PARTICLES.map((id) => <Essence key={id} id={id} color={kit[id % 5]} from={samples[id % 5]} baku={baku} state={state} reduced={reduced} />)}
          {PAGE_IDS.map((page) => <AtlasPage key={page} page={page} image={images[page]!} mask={masks[page]!} state={state} position={baku} kit={kit} />)}
          {slots.map((p, i) => <RoundedRect key={i} x={p.x - 20} y={p.y - 16} width={40} height={32} r={9} color="#D6CCBC" />)}
          {slots.map((to, i) => <FlyingChip key={i} index={i} color={kit[i]} state={state} origin={sneezeOrigin} to={to} reduced={reduced} />)}
        </>}
      </Canvas>
      <Text style={{ position: 'absolute', top: 170, left: 12, fontSize: 11, color: '#625C54' }}>
        {error ?? (!stripeEffect ? 'Stripe shader compilation failed.' : !ready ? 'Preloading + warming atlases…' : `${telemetry.fps || '—'} UI fps · ${telemetry.drops} dropped · ${telemetry.stage} · ${DENSITY}x`)}
      </Text>
      <View style={{ position: 'absolute', top: 401, width, flexDirection: 'row', justifyContent: 'center' }} pointerEvents="none">
        {LAB_ROLES.map((role) => <Text key={role} style={{ width: 48, fontSize: 8, textAlign: 'center', color: '#625C54' }}>{role}</Text>)}
      </View>
    </View>
  );
}

function FlyingChip({ index, color, state, origin, to, reduced }: {
  index: number; color: string; state: SharedValue<Playback>; origin: SharedValue<Point>; to: Point; reduced: SharedValue<boolean>;
}) {
  const progress = useDerivedValue(() => state.get().stage === 'landed' ? 1 : state.get().stage === 'sneeze'
    ? chipProgress(state.get().elapsed - state.get().sneezeAt, index) : 0);
  const transform = useDerivedValue(() => {
    const p = progress.get();
    const position = reduced.get() ? to : chipPosition(origin.get(), to, p);
    return [{ translateX: position.x }, { translateY: position.y }, { rotate: reduced.get() ? 0 : Math.sin(Math.PI * p) * .55 * (index % 2 ? -1 : 1) }];
  });
  const opacity = useDerivedValue(() => state.get().stage === 'landed' ? 1 : state.get().stage !== 'sneeze' ? 0
    : reduced.get() ? Math.min(1, Math.max(0, (state.get().elapsed - state.get().sneezeAt) / 180)) : progress.get() > 0 ? 1 : 0);
  return <Group transform={transform} opacity={opacity}>
    <RoundedRect x={-20} y={-16} width={40} height={32} r={9} color={color} />
    <RoundedRect x={-20} y={-16} width={40} height={32} r={9} style="stroke" strokeWidth={1} color="#332D2844" />
  </Group>;
}

// Export timing so the lab readout and sequence test use the same deadline.
export const landingDeadline = LANDING_MS;
