import { act, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { CornerBaku } from './CornerBaku';
import * as blinks from '@/lib/blink';

beforeEach(() => { jest.useFakeTimers(); jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('idle breathes over 2.4 seconds and cancels the blink scheduler on unmount', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const view = await render(<CornerBaku focused />);
  expect(timing).toHaveBeenCalledWith(1.015, expect.objectContaining({ duration: 1200 }));
  await act(async () => jest.advanceTimersByTime(4999));
  expect(timing).not.toHaveBeenCalledWith(1, { duration: 70 });
  await act(async () => jest.advanceTimersByTime(1));
  expect(timing).toHaveBeenCalledWith(1, { duration: 70 });
  expect(timing).toHaveBeenCalledWith(0, { duration: 90 });
  await view.unmount();
  const count = timing.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(20000));
  expect(timing).toHaveBeenCalledTimes(count);
});

test('blur cancels loops, refocus restarts, reduced motion cancels them again', async () => {
  const stops: jest.Mock[] = [];
  const original = blinks.scheduleBlinks;
  const schedule = jest.spyOn(blinks, 'scheduleBlinks').mockImplementation((blink, options) => {
    const stop = jest.fn(original(blink, options)); stops.push(stop); return stop;
  });
  const view = await render(<CornerBaku focused />);
  expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), { active: true, reducedMotion: false });
  await view.rerender(<CornerBaku focused={false} />);
  expect(stops[0]).toHaveBeenCalledTimes(1);
  expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), { active: false, reducedMotion: false });
  await view.rerender(<CornerBaku focused />);
  expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), { active: true, reducedMotion: false });
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  await view.rerender(<CornerBaku focused />);
  expect(stops[2]).toHaveBeenCalledTimes(1);
  expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), { active: true, reducedMotion: true });
  await view.unmount();
  expect(stops[3]).toHaveBeenCalledTimes(1);
});

test('reduced motion success uses a 150ms fade and never breathes or blinks', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const schedule = jest.spyOn(blinks, 'scheduleBlinks');
  const view = await render(<CornerBaku focused />);
  await view.rerender(<CornerBaku focused pose="success" />);
  expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 150 }));
  expect(timing).not.toHaveBeenCalledWith(1.015, expect.anything());
  expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), { active: false, reducedMotion: true });
  expect(view.getByTestId('baku-success')).toBeTruthy();
});

test('releases the previous pose after the fade', async () => {
  const view = await render(<CornerBaku focused pose="chewing" />);
  await view.rerender(<CornerBaku focused pose="idle" />);
  expect(view.getByTestId('result-baku-previous-pose', { includeHiddenElements: true })).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(150));
  expect(view.queryByTestId('result-baku-previous-pose', { includeHiddenElements: true })).toBeNull();
});
