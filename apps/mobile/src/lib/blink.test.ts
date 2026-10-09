import { blinkDelay, BLINK, scheduleBlinks } from './blink';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('blink waits are randomized between four and six seconds', () => {
  expect(blinkDelay(() => 0)).toBe(4000);
  expect(blinkDelay(() => 1)).toBe(6000);
  expect(blinkDelay(() => 0.37)).toBe(4740);
  const random = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValue(0.5);
  const blink = jest.fn();
  const stop = scheduleBlinks(blink, { random });
  jest.advanceTimersByTime(3999);
  expect(blink).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(blink).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(5999);
  expect(blink).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(blink).toHaveBeenCalledTimes(2);
  stop();
  expect(BLINK).toMatchObject({ closeMs: 70, holdMs: 60, openMs: 90 });
});

test('cancellation clears the timer and prevents callbacks after unmount', () => {
  const blink = jest.fn();
  const stop = scheduleBlinks(blink);
  expect(jest.getTimerCount()).toBe(1);
  stop(); stop();
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(30000);
  expect(blink).not.toHaveBeenCalled();
});

test.each([{ reducedMotion: true }, { active: false }])('no scheduler runs with %j', (options) => {
  const blink = jest.fn();
  scheduleBlinks(blink, options)();
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(30000);
  expect(blink).not.toHaveBeenCalled();
});
