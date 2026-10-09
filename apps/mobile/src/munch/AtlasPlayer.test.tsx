import { act, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import * as Worklets from 'react-native-worklets';
import { AtlasPlayer, LAB_KITS, type LabController } from './AtlasPlayer';
import type { Playback } from './types';

type Tick = (frame: { timeSincePreviousFrame: number | null }) => void;
let mockTick: Tick;
let mockRegistrations: number;
let mockClock: Reanimated.FrameCallback;
let mockFocus: () => void | (() => void);
let mockBlur: void | (() => void);

// Jest cannot resolve logical asset names backed only by @2x/@3x files.
// Native export separately exercises Metro's real asset resolution.
jest.mock('./assets', () => ({ atlasDensity: 3, atlasSources: [1, 2, 3, 4], stripeSources: [5, 6, 7, 8], testPhoto: 9 }));

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: typeof mockFocus) => {
    jest.requireActual<typeof import('react')>('react').useEffect(() => {
      mockFocus = effect;
      mockBlur = effect();
      return () => { mockBlur?.(); };
    }, [effect]);
  },
}));
// The installed official mock omits this hook and is already loaded by setup.
Object.defineProperty(Reanimated, 'useFrameCallback', { configurable: true, writable: true, value: jest.fn() });

const Skia = jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');
let controller: LabController;
let playback: Reanimated.SharedValue<Playback>;
let appChange: (value: AppStateStatus) => void;
let reduceChange: (value: boolean) => void;
let rnQueue: (() => void)[];
let extractionTimer: ReturnType<typeof setTimeout>;
const originalAppState = AppState.currentState;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');
  jest.spyOn(global, 'clearTimeout');
  mockRegistrations = 0;
  rnQueue = [];
  // Model the installed hook's dependency on callback identity: rerenders
  // must not unregister/register it or restart the first-frame timestamp.
  jest.spyOn(Reanimated, 'useFrameCallback').mockImplementation(function useTestFrameCallback(callback, autostart = true) {
    const ref = useRef<Reanimated.FrameCallback | null>(null);
    if (!ref.current) {
      ref.current = { callbackId: 0, isActive: autostart, setActive: jest.fn((active) => { ref.current!.isActive = active; }) };
    }
    useEffect(() => {
      mockRegistrations++;
      mockTick = (frame) => callback({ timestamp: 0, timeSinceFirstFrame: 0, ...frame });
      mockClock = ref.current!;
    }, [callback, autostart]);
    return ref.current;
  });
  AppState.currentState = 'active';
  jest.spyOn(Skia, 'useImage').mockReturnValue({} as never);
  jest.spyOn(Skia, 'Canvas').mockImplementation(() => <></>);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((...args: unknown[]) => {
    reduceChange = args[1] as typeof reduceChange;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appChange = callback;
    return { remove: jest.fn() };
  });
  jest.spyOn(Worklets, 'scheduleOnUI').mockImplementation((fn, ...args) => fn(...args));
  jest.spyOn(Worklets, 'scheduleOnRN').mockImplementation((fn, ...args) => {
    rnQueue.push(() => fn(...args));
  });
  const shared = Reanimated.useSharedValue;
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial) => {
    const value = shared(initial);
    if (initial && typeof initial === 'object' && 'stage' in initial) playback = value as typeof playback;
    return value;
  });
});
afterEach(() => {
  AppState.currentState = originalAppState;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function flushRN() {
  await act(async () => { const queue = rnQueue.splice(0); queue.forEach((fn) => fn()); });
}
async function tick(delta: number | null, flush = true) {
  await act(async () => { if (mockClock.isActive) mockTick({ timeSincePreviousFrame: delta }); });
  if (flush) await flushRN();
}
async function setup() {
  const view = await render(<AtlasPlayer width={360} kit={LAB_KITS[0]} onController={(value) => { controller = value; }} />);
  for (let i = 0; i < 3; i++) await tick(1000 / 60);
  expect(controller.ready).toBe(true);
  await act(async () => controller.start(15));
  const timerCall = jest.mocked(setTimeout).mock.calls.findIndex(([, delay]) => delay === 15000);
  extractionTimer = jest.mocked(setTimeout).mock.results[timerCall].value;
  await tick(null);
  return view;
}

test('telemetry and kit rerenders preserve registration and the continuous clock', async () => {
  const view = await setup();
  const registrations = mockRegistrations;
  for (let i = 0; i < 20; i++) await tick(25);
  expect(view.getByText(/40 UI fps · 10 dropped/)).toBeTruthy();
  expect(mockRegistrations).toBe(registrations);
  await view.rerender(<AtlasPlayer width={360} kit={LAB_KITS[1]} onController={(value) => { controller = value; }} />);
  expect(mockRegistrations).toBe(registrations);
  expect(playback.get().elapsed).toBe(500);
});

test('blur, background and unmount stop the clock; resuming excludes the pause', async () => {
  const view = await setup();
  await tick(100);
  await act(async () => mockBlur?.());
  expect(mockClock.isActive).toBe(false);
  await tick(5000);
  expect(playback.get().elapsed).toBe(100);
  await act(async () => { mockBlur = mockFocus(); });
  await tick(5000);
  expect(playback.get().elapsed).toBe(100);
  await act(async () => { AppState.currentState = 'background'; appChange('background'); });
  expect(mockClock.isActive).toBe(false);
  await act(async () => { AppState.currentState = 'active'; appChange('active'); });
  await tick(5000);
  expect(playback.get().elapsed).toBe(100);
  await tick(100);
  expect(playback.get().elapsed).toBe(200);
  await view.unmount();
  expect(mockClock.isActive).toBe(false);
  expect(clearTimeout).toHaveBeenCalledWith(extractionTimer);
});

test('queued haptics expire and Reduce Motion also blocks an already queued event', async () => {
  await setup();
  jest.mocked(Haptics.impactAsync).mockClear();
  await tick(300, false);
  await act(async () => { jest.advanceTimersByTime(101); });
  await flushRN();
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  await tick(200, false);
  await act(async () => reduceChange(true));
  await flushRN();
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  await tick(300);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

test('skip and replay cancel the previous extraction and its queued haptics', async () => {
  await setup();
  jest.mocked(Haptics.impactAsync).mockClear();
  await tick(300, false);
  await act(async () => controller.skip());
  await tick(0);
  expect(playback.get().stage).toBe('landed');
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(clearTimeout).toHaveBeenCalledWith(extractionTimer);
  await act(async () => controller.start(0));
  await act(async () => { jest.advanceTimersByTime(0); });
  await tick(null);
  await tick(1200);
  expect(playback.get().stage).toBe('sneeze');
  await tick(1200);
  expect(playback.get().stage).toBe('landed');
});
