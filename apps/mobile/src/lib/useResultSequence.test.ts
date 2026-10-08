import { act, renderHook } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';
import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { FADE_TIMING, resultSequenceBeats } from '@/theme/motion';
import { createHaptics, haptics } from './haptics';
import { completedResultKits, useResultSequence } from './useResultSequence';

beforeEach(() => {
  completedResultKits.clear();
  jest.useFakeTimers();
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
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: false } });
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
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: true } });
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
  expect(cancel).toHaveBeenCalledTimes(20);
  await advance(3000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('skipping while pending leaves the hero to land once and become interactive normally', async () => {
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: false } });
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
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: true } });
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
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: true } });
  expect(spring).not.toHaveBeenCalled();
  expect(repeat).not.toHaveBeenCalled();
  expect(delay.mock.calls.every(([ms]) => ms === 0)).toBe(true);
  expect(timing.mock.calls.every(([, config]) => config?.duration === FADE_TIMING.duration)).toBe(true);
  expect(timing).toHaveBeenCalledTimes(4); // Baku, one band fade, markers, brief.
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
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'kit-1', ready: true } });
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
  const hook = await renderHook(useResultSequence, {
    initialProps: { kitId: 'kit-1', ready: true },
    wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
  });
  expect(hook.result.current.interactive).toBe(false);
  await advance(resultSequenceBeats(6, false).interactiveMs);
  expect(hook.result.current.interactive).toBe(true);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('stripe reveals start at 120ms and advance every 60ms; pending stays at zero', async () => {
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'tint-kit', ready: false } });
  await advance(1000);
  expect(hook.result.current.revealedBands).toBe(0);
  await hook.rerender({ kitId: 'tint-kit', ready: true });
  for (let index = 0; index < 6; index++) {
    await advance(index === 0 ? 119 : 59);
    expect(hook.result.current.revealedBands).toBe(index);
    await advance(1);
    expect(hook.result.current.revealedBands).toBe(index + 1);
  }
  await hook.rerender({ kitId: 'next-kit', ready: false });
  expect(hook.result.current.revealedBands).toBe(0);
  await advance(1000);
  expect(hook.result.current.revealedBands).toBe(0);
});

test('skip reveals all six immediately and cancels subsequent stripe timers', async () => {
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  await advance(120);
  expect(hook.result.current.revealedBands).toBe(1);
  await act(async () => hook.result.current.skipToEnd());
  expect(hook.result.current.revealedBands).toBe(6);
  await advance(2000);
  expect(hook.result.current.revealedBands).toBe(6);
});

test('reduced motion reveals all six together when the hero becomes ready', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const hook = await renderHook(useResultSequence, { initialProps: { kitId: 'tint-kit', ready: false } });
  expect(hook.result.current.revealedBands).toBe(0);
  await hook.rerender({ kitId: 'tint-kit', ready: true });
  expect(hook.result.current.revealedBands).toBe(6);
});

test('finished kits keep all six revealed on revisit without replaying the hero', async () => {
  const first = await renderHook(useResultSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  await advance(resultSequenceBeats(6, false).interactiveMs);
  expect(first.result.current.revealedBands).toBe(6);
  await first.unmount();
  const revisit = await renderHook(useResultSequence, { initialProps: { kitId: 'tint-kit', ready: true } });
  expect(revisit.result.current.revealedBands).toBe(6);
  expect(revisit.result.current.interactive).toBe(true);
  await advance(2000);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
});
