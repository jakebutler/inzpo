import * as ExpoHaptics from 'expo-haptics';
import { createHaptics, HAPTIC_BUDGET_MS } from './haptics';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('shares one 300ms budget across event types and admits the boundary', async () => {
  const feedback = createHaptics();
  await feedback.light();
  jest.advanceTimersByTime(HAPTIC_BUDGET_MS - 1);
  await feedback.success();
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await feedback.success();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
});

test('loupe ticks have a separate 80ms budget, change only with hex, and stop for reduced motion', async () => {
  const feedback = createHaptics();
  await feedback.soft();
  await feedback.selection('#aabbcc', false);
  await feedback.selection('#ddeeff', false);
  jest.advanceTimersByTime(80);
  await feedback.selection('#AABBCC', false);
  expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  await feedback.selection('#ddeeff', false);
  expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(80);
  await feedback.selection('#ffffff', true);
  expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(2);
});

test('a native feedback failure never rejects a successful data operation', async () => {
  jest.mocked(ExpoHaptics.notificationAsync).mockRejectedValueOnce(new Error('unavailable'));
  await expect(createHaptics().success()).resolves.toBeUndefined();
});
