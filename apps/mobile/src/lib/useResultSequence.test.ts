import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';
import { mockReanimatedTiming } from '../../tests/reanimated-timing';
import { act, renderHook } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';
import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { FADE_TIMING, RESULT_TIMELINE, resultSequenceBeats } from '@/theme/motion';
import { createHaptics, haptics } from './haptics';
import { completedResultKits, useResultSequence } from './useResultSequence';

const roles: RoleColors = {
  primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
  background: '#ffffff', surface: '#123456', text: '#000000',
};
function useSequence(props: { kitId: string; ready: boolean; roles?: RoleColors }) {
  return useResultSequence({ ...props, roles: props.roles ?? roles });
}

beforeEach(() => {
  completedResultKits.clear();
  jest.useFakeTimers();
  mockReanimatedTiming();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  Object.assign(haptics, createHaptics());
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

test('pending to ready lands once at 740ms and enables buttons at the brief beat', async () => {
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: false } });
  expect(hook.result.current.interactive).toBe(false);
  await hook.rerender({ kitId: 'kit-1', ready: true });
  const beats = resultSequenceBeats(6, false);
  await advance(beats.landingMs - 1);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await advance(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Soft);
  expect(hook.result.current.interactive).toBe(false);
  await advance(beats.interactiveMs - beats.landingMs);
  expect(hook.result.current.interactive).toBe(true);
  await hook.rerender({ kitId: 'kit-1', ready: true });
  await advance(2000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('a first visit already ready still plays once; skipping after landing sets every end value without another haptic', async () => {
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: true } });
  expect(hook.result.current.interactive).toBe(false);
  await advance(resultSequenceBeats(6, false).landingMs);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  await act(async () => hook.result.current.skipToEnd());
  expect(hook.result.current.interactive).toBe(true);
  hook.result.current.bands.forEach((band) => {
    expect(band.opacity.value).toBe(1);
    expect(band.translateY.value).toBe(0);
  });
  const values = hook.result.current.values;
  expect(values.bakuY.value).toBe(0);
  expect(values.bakuScaleX.value).toBe(1);
  expect(values.bakuScaleY.value).toBe(1);
  expect(values.bakuOpacity.value).toBe(1);
  expect(values.markerScale.value).toBe(1);
  expect(values.markerOpacity.value).toBe(1);
  expect(values.briefY.value).toBe(0);
  expect(values.briefOpacity.value).toBe(1);
  expect(cancel).toHaveBeenCalledTimes(26);
  await advance(3000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('skipping while pending leaves the hero to land once and become interactive normally', async () => {
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: false } });
  await act(async () => hook.result.current.skipToEnd());
  expect(hook.result.current.interactive).toBe(false);
  await hook.rerender({ kitId: 'kit-1', ready: true });
  expect(hook.result.current.interactive).toBe(false);
  const beats = resultSequenceBeats(6, false);
  await advance(beats.landingMs - 1);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await advance(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Soft);
  expect(hook.result.current.interactive).toBe(false);
  await advance(beats.interactiveMs - beats.landingMs);
  expect(hook.result.current.interactive).toBe(true);
  await advance(3000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('skipping an active sequence before landing cancels all future beats', async () => {
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: true } });
  await advance(200);
  await act(async () => hook.result.current.skipToEnd());
  await advance(2000);
  expect(hook.result.current.interactive).toBe(true);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
});

test('reduced motion fades all bands together over 150ms and still lands with one haptic', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const spring = jest.spyOn(Reanimated, 'withSpring');
  const delay = jest.spyOn(Reanimated, 'withDelay');
  const repeat = jest.spyOn(Reanimated, 'withRepeat');
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: true } });
  expect(spring).not.toHaveBeenCalled();
  expect(repeat).not.toHaveBeenCalled();
  expect(delay.mock.calls.every(([ms]) => ms === 0)).toBe(true);
  expect(timing.mock.calls.every(([, config]) => config?.duration === FADE_TIMING.duration)).toBe(true);
  expect(timing).toHaveBeenCalledTimes(10); // Six stripe mixes, Baku, bands, markers, brief.
  expect(hook.result.current.bands.every((band) => band.opacity === hook.result.current.bands[0].opacity)).toBe(true);
  hook.result.current.bands.forEach((band) => expect(band.translateY.value).toBe(0));
  expect(hook.result.current.values.bakuY.value).toBe(0);
  expect(hook.result.current.values.bakuScaleX.value).toBe(1);
  expect(hook.result.current.values.bakuScaleY.value).toBe(1);
  await advance(149);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  expect(hook.result.current.interactive).toBe(false);
  await advance(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Soft);
  expect(hook.result.current.interactive).toBe(true);
  await advance(2000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('unmount cancels beats and changing kit identity starts a fresh sequence', async () => {
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'kit-1', ready: true } });
  await advance(400);
  await hook.rerender({ kitId: 'kit-2', ready: true });
  await advance(739);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await advance(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  await hook.rerender({ kitId: 'kit-3', ready: true });
  await hook.unmount();
  await advance(3000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('Strict Mode effect restart still lands once and waits to enable buttons', async () => {
  const hook = await renderHook(useSequence, {
    initialProps: { kitId: 'kit-1', ready: true },
    wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
  });
  expect(hook.result.current.interactive).toBe(false);
  await advance(resultSequenceBeats(6, false).interactiveMs);
  expect(hook.result.current.interactive).toBe(true);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test.each(COLOR_ROLES.map((role, index) => ({ role, index })))('$role starts at 120 + 60i and finishes its wipe 180ms later', async ({ index }) => {
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'tint-kit', ready: false } });
  await advance(1000);
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([0, 0, 0, 0, 0, 0]);
  await hook.rerender({ kitId: 'tint-kit', ready: true });
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(hook.result.current.wipeMode).toBe(0);
  const stripe = hook.result.current.stripeProgress[index];
  await advance(RESULT_TIMELINE.bandStartMs + RESULT_TIMELINE.bandStaggerMs * index - 1);
  expect(stripe.value).toBe(0);
  await advance(1);
  expect(stripe.value).toBe(0);
  await advance(RESULT_TIMELINE.stripeWipeMs / 2);
  expect(stripe.value).toBeCloseTo(0.5);
  await advance(RESULT_TIMELINE.stripeWipeMs / 2 - 1);
  expect(stripe.value).toBeLessThan(1);
  await advance(1);
  expect(stripe.value).toBe(1);
  await hook.rerender({ kitId: 'next-kit', ready: false });
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([0, 0, 0, 0, 0, 0]);
});

test('empty role never schedules a wipe, including on skip or revisit', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const partial = { ...roles, accent: null };
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'partial', ready: true, roles: partial } });
  const wipes = timing.mock.calls.filter(([, config]) => config?.duration === RESULT_TIMELINE.stripeWipeMs);
  expect(wipes).toHaveLength(5);
  await advance(200);
  expect(hook.result.current.stripeProgress[2].value).toBe(0);
  await act(async () => hook.result.current.skipToEnd());
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 0, 1, 1, 1]);
  await advance(2000);
  await hook.unmount();
  const revisit = await renderHook(useSequence, { initialProps: { kitId: 'partial', ready: true, roles: partial } });
  expect(revisit.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 0, 1, 1, 1]);
});

test('skip dyes every filled stripe immediately and cancels every pending animation', async () => {
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  await advance(200);
  const stripes = hook.result.current.stripeProgress;
  expect(stripes[0].value).toBeGreaterThan(0);
  expect(stripes[0].value).toBeLessThan(1);
  await act(async () => hook.result.current.skipToEnd());
  stripes.forEach((progress) => {
    expect(cancel).toHaveBeenCalledWith(progress);
    expect(progress.value).toBe(1);
  });
  await advance(2000);
  expect(stripes.map((progress) => progress.value)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
});

test('reduced motion mixes all stripes at the same moment as the shared band fade', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'tint-kit', ready: false } });
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([0, 0, 0, 0, 0, 0]);
  await hook.rerender({ kitId: 'tint-kit', ready: true });
  expect(hook.result.current.wipeMode).toBe(1);
  await advance(75);
  hook.result.current.stripeProgress.forEach((progress) => expect(progress.value).toBeCloseTo(0.5));
  expect(hook.result.current.bands[0].opacity.value).toBeCloseTo(0.5);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await advance(75);
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  await advance(2000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('reduced motion never animates an empty role', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const hook = await renderHook(useSequence, { initialProps: { kitId: 'partial', ready: true, roles: { ...roles, accent: null } } });
  expect(timing).toHaveBeenCalledTimes(9); // Five stripe mixes and four other fades.
  await advance(150);
  expect(hook.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 0, 1, 1, 1]);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('finished kits are fully dyed immediately on revisit without replaying the hero', async () => {
  const first = await renderHook(useSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  await advance(resultSequenceBeats(6, false).interactiveMs);
  expect(first.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 1, 1, 1, 1]);
  await first.unmount();
  const timing = jest.spyOn(Reanimated, 'withTiming');
  timing.mockClear();
  const revisit = await renderHook(useSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  expect(revisit.result.current.stripeProgress.map((progress) => progress.value)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(revisit.result.current.interactive).toBe(true);
  expect(timing).not.toHaveBeenCalled();
  await advance(2000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('progress updates do not rerender React or replay on refreshed role objects', async () => {
  const renders = jest.fn();
  const hook = await renderHook((props: Parameters<typeof useSequence>[0]) => {
    renders();
    return useSequence(props);
  }, { initialProps: { kitId: 'tint-kit', ready: true, roles } });
  const count = renders.mock.calls.length;
  await advance(400);
  expect(renders).toHaveBeenCalledTimes(count);
  const progress = hook.result.current.stripeProgress[5];
  expect(progress.value).toBe(0);
  await hook.rerender({ kitId: 'tint-kit', ready: true, roles: { ...roles } });
  expect(progress.value).toBe(0);
  await advance(110);
  expect(progress.value).toBeCloseTo(0.5);
});
