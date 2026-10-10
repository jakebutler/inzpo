import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { MunchPlayer } from './MunchPlayer';
import { feltTint } from './felt-tint';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const Skia = jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

afterEach(() => jest.restoreAllMocks());

test('reduced motion decodes only the cream still, without the atlas or frame clock', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const image = jest.spyOn(Skia, 'useImage');
  const view = await render(<MunchPlayer width={280} />);
  expect(view.getByTestId('baku-chewing')).toHaveStyle({ width: 280 });
  expect(view.queryByTestId('munch-atlas')).toBeNull();
  expect(image).toHaveBeenCalledTimes(1);
  expect(image.mock.calls[0][0]).toEqual(expect.objectContaining({ testUri: expect.stringContaining('munch/still.png') }));
  expect(Reanimated.useFrameCallback).not.toHaveBeenCalled();
  await view.unmount();
});

test('the loaded reduced-motion still uses the same cream filter as playback', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const image = Skia.Skia.Image.MakeImageFromEncoded(Skia.Skia.Data.fromBytes(
    readFileSync(resolve(__dirname, '../../assets/munch/still.png')),
  ))!;
  jest.spyOn(Skia, 'useImage').mockReturnValue(image);
  const tint = jest.spyOn(Skia, 'Shader');
  const view = await render(<MunchPlayer width={280} />);
  expect(tint.mock.calls[0][0].source).toBe(feltTint);
  expect(tint.mock.calls[0][0].uniforms).toEqual({ width: 280, frameOffset: [0, 0] });
  await view.unmount();
  image.dispose();
});

test('playback pauses offscreen/backgrounded, resumes without a time jump, and cleans up on reduced motion', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  const image = Skia.Skia.Image.MakeImageFromEncoded(Skia.Skia.Data.fromBytes(
    readFileSync(resolve(__dirname, '../../assets/munch/chew.webp')),
  ))!;
  jest.spyOn(Skia, 'useImage').mockReturnValue(image);
  const tint = jest.spyOn(Skia, 'Shader');
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
  expect(tint.mock.calls[0][0].source).toBe(feltTint);
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
  image.dispose();
});
