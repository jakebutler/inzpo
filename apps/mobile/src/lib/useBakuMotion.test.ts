import { act, renderHook } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { HOP_TIMELINE, PUPIL_SPRING } from '@/theme/motion';
import { mockReanimatedMotion } from '../../tests/reanimated-motion';
import { useBakuPupils } from './useBakuPupils';
import { useBakuHop } from './useBakuHop';

beforeEach(() => {
  jest.useFakeTimers(); mockReanimatedMotion();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

test('jiggle kicks two points in sprite pixels, oscillates, then returns to zero', async () => {
  const hook = await renderHook(() => useBakuPupils(96));
  await act(async () => hook.result.current.jiggle({ x: 0, y: 1 }));
  expect(hook.result.current.offset.value).toEqual({ x: 0, y: 3 });
  expect(Reanimated.withSpring).toHaveBeenCalledWith({ x: 0, y: 0 }, PUPIL_SPRING);
  await advance(200);
  expect(hook.result.current.offset.value.y).toBeLessThan(0);
  await advance(1600);
  expect(hook.result.current.offset.value).toEqual({ x: 0, y: 0 });
});
test('jiggle follows the impulse direction and reduced motion cancels it', async () => {
  const hook = await renderHook(() => useBakuPupils(48));
  await act(async () => hook.result.current.jiggle({ x: -1, y: 0 }));
  expect(hook.result.current.offset.value).toEqual({ x: -6, y: 0 });
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  await hook.rerender(undefined);
  jest.mocked(Reanimated.withSpring).mockClear();
  await act(async () => hook.result.current.jiggle({ x: 1, y: 1 }));
  expect(hook.result.current.offset.value).toEqual({ x: 0, y: 0 });
  expect(Reanimated.withSpring).not.toHaveBeenCalled();
});
const jiggle = jest.fn();
function useMotion({ kitId = 'one' } = {}) {
  const base = {
    bakuY: Reanimated.useSharedValue(3), bakuScaleX: Reanimated.useSharedValue(1.02),
    bakuScaleY: Reanimated.useSharedValue(0.98), bakuOpacity: Reanimated.useSharedValue(0.9),
  };
  return { ...useBakuHop({ kitId, base, jiggle }), base };
}

test('hop squashes, peaks at -14 with an 80% shadow, lands, jiggles, and rests', async () => {
  const hook = await renderHook(useMotion);
  await act(async () => hook.result.current.onSaved());
  expect(hook.result.current.pose).toBe('success');
  await advance(HOP_TIMELINE.anticipationMs);
  expect(hook.result.current.values.scaleY.value).toBe(0.92);
  expect(hook.result.current.values.scaleX.value).toBe(1.06);
  await advance(HOP_TIMELINE.takeoffMs);
  expect(hook.result.current.values.translateY.value).toBe(-14);
  expect(hook.result.current.values.scaleY.value).toBe(1.04);
  expect(hook.result.current.values.shadowScale.value).toBe(0.8);
  await hook.rerender(undefined);
  expect(hook.result.current.bakuStyle).toEqual(expect.objectContaining({
    opacity: 0.9, transform: [{ translateY: -11 }, { scaleX: 1.02 }, { scaleY: 0.98 * 1.04 }],
  }));
  await advance(HOP_TIMELINE.flightMs);
  expect(hook.result.current.values.translateY.value).toBe(0);
  expect(jiggle).toHaveBeenCalledTimes(1);
  expect(jiggle).toHaveBeenCalledWith({ x: 0, y: 1 });
  await advance(HOP_TIMELINE.landingMs);
  expect(hook.result.current.values.scaleY.value).toBe(0.95);
  await advance(320);
  expect(Object.values(hook.result.current.values).map((v) => v.value)).toEqual([0, 1, 1, 1]);
  expect(Object.values(hook.result.current.base).map((v) => v.value)).toEqual([3, 1.02, 0.98, 0.9]);
  await advance(1999 - 80 - 120 - 320 - 60 - 320);
  expect(hook.result.current.pose).toBe('success');
  await advance(1);
  expect(hook.result.current.pose).toBe('idle');
});
test('reduced motion changes pose for 2s with no hop, squash, shadow animation, or jiggle', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const hook = await renderHook(useMotion);
  await act(async () => hook.result.current.onSaved());
  expect(hook.result.current.pose).toBe('success');
  expect(Object.values(hook.result.current.values).map((v) => v.value)).toEqual([0, 1, 1, 1]);
  expect(Reanimated.withTiming).not.toHaveBeenCalled();
  expect(Reanimated.withSpring).not.toHaveBeenCalled();
  await advance(2000);
  expect(hook.result.current.pose).toBe('idle');
  expect(jiggle).not.toHaveBeenCalled();
});
test('failure, kit change, and unmount cancel pending hop phases and pose holds', async () => {
  const hook = await renderHook(useMotion, { initialProps: { kitId: 'one' } });
  await act(async () => hook.result.current.onSaved());
  await advance(100);
  await act(async () => hook.result.current.onSaveError());
  expect(hook.result.current.pose).toBe('errorBrief');
  expect(Object.values(hook.result.current.values).map((v) => v.value)).toEqual([0, 1, 1, 1]);
  await advance(2000);
  expect(hook.result.current.pose).toBe('errorBrief');
  expect(jiggle).not.toHaveBeenCalled();
  await act(async () => hook.result.current.onSaved());
  await hook.rerender({ kitId: 'two' });
  await advance(2000);
  expect(hook.result.current.pose).toBeNull();
  await act(async () => hook.result.current.onSaved());
  await hook.unmount();
  await advance(3000);
  expect(jiggle).not.toHaveBeenCalled();
});
