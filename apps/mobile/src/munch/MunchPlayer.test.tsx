import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import type { SkImage } from '@shopify/react-native-skia';
import { MunchPlayer } from './MunchPlayer';

const Skia = jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

afterEach(() => jest.restoreAllMocks());

test('reduced motion shows a large still without decoding or running frames', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const image = jest.spyOn(Skia, 'useImage');
  const view = await render(<MunchPlayer width={280} />);
  expect(view.getByTestId('baku-chewing')).toHaveStyle({ width: 280 });
  expect(view.queryByTestId('munch-atlas')).toBeNull();
  expect(image).not.toHaveBeenCalled();
  expect(Reanimated.useFrameCallback).not.toHaveBeenCalled();
  await view.unmount();
});

test('playback pauses offscreen/backgrounded, resumes without a time jump, and cleans up on reduced motion', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  jest.spyOn(Skia, 'useImage').mockReturnValue({ width: () => 3168 } as SkImage);
  let appChanged!: (state: typeof AppState.currentState) => void;
  let motionChanged!: (reduced: boolean) => void;
  const removeApp = jest.fn(), removeMotion = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appChanged = callback;
    return { remove: removeApp };
  });
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
    motionChanged = callback as unknown as (reduced: boolean) => void;
    return { remove: removeMotion } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  const view = await render(<MunchPlayer width={280} />);
  const clock = jest.mocked(Reanimated.useFrameCallback).mock.results.at(-1)!.value;
  expect(view.getByTestId('munch-atlas')).toBeTruthy();
  await act(async () => appChanged('background'));
  expect(clock.setActive).toHaveBeenLastCalledWith(false);
  await act(async () => appChanged('active'));
  expect(clock.setActive).toHaveBeenLastCalledWith(true);
  const values = jest.mocked(Reanimated.useFrameCallback).mock.calls.at(-1)![0];
  // The first callback after resuming ignores the background interval.
  await act(async () => values({ timestamp: 10000, timeSincePreviousFrame: 10000, timeSinceFirstFrame: 10000 }));
  await view.rerender(<MunchPlayer width={280} active={false} />);
  expect(clock.setActive).toHaveBeenLastCalledWith(false);
  await act(async () => motionChanged(true));
  expect(view.queryByTestId('munch-atlas')).toBeNull();
  expect(view.getByTestId('baku-chewing')).toBeTruthy();
  expect(clock.setActive).toHaveBeenLastCalledWith(false);
  await view.unmount();
  expect(removeApp).toHaveBeenCalled();
  expect(removeMotion).toHaveBeenCalled();
});
