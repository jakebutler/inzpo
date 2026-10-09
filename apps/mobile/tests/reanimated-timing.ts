import { useRef } from 'react';
import * as Reanimated from 'react-native-reanimated';

// The installed official mock completes timing/delay immediately. This adapter
// lets hook tests inspect elapsed progress with Jest's clock, without frames or
// React renders. Other mocked animations keep their official behavior.
type Timing = { target: number; duration: number; delay: number };
type Run = Timing & { from: number; started: number };

export function mockReanimatedTiming() {
  const runs = new WeakMap<object, Run>();
  const timing = jest.spyOn(Reanimated, 'withTiming').mockImplementation((target, config) => (
    { target, duration: config?.duration ?? 300, delay: 0 } as unknown as typeof target
  ));
  const delay = jest.spyOn(Reanimated, 'withDelay').mockImplementation((ms, animation) => (
    { ...(animation as unknown as Timing), delay: ms } as unknown as typeof animation
  ));
  const originalSharedValue = Reanimated.useSharedValue;
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial) => {
    const shared = originalSharedValue(initial);
    const ref = useRef<typeof shared | null>(null);
    if (!ref.current) {
      const read = () => {
        const run = runs.get(shared);
        if (!run) return shared.value;
        const fraction = Math.max(0, Math.min(1, (Date.now() - run.started - run.delay) / run.duration));
        return run.from + (run.target - run.from) * fraction;
      };
      const write = (next: unknown) => {
        if (typeof next === 'function') next = next(read());
        if (typeof next === 'object' && next !== null && 'target' in next) {
          runs.set(shared, { ...(next as Timing), from: read() as number, started: Date.now() });
        } else {
          runs.delete(shared);
          shared.set(next);
        }
      };
      ref.current = new Proxy(shared, {
        get: (target, property) => {
          if (property === 'value') return read();
          if (property === 'get') return read;
          if (property === 'set') return write;
          return Reflect.get(target, property);
        },
        set: (target, property, next) => {
          if (property === 'value') { write(next); return true; }
          return Reflect.set(target, property, next);
        },
      });
    }
    return ref.current;
  });
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation').mockImplementation((shared) => {
    // Setting the current numeric value stops the adapter's pending timing.
    shared.set(shared.value);
  });
  return { timing, delay, cancel };
}
