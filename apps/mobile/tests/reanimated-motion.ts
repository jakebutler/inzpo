import { useRef } from 'react';
import * as Reanimated from 'react-native-reanimated';

type Value = number | { x: number; y: number };
type Callback = (finished?: boolean) => void;
type Leaf = { kind: 'timing' | 'spring'; target: Value; duration: number; callback?: Callback; damping?: number; stiffness?: number };
type Plan = Leaf | { kind: 'sequence'; plans: Plan[] };

// The installed mock resolves springs instantly and drops sequences entirely.
// This clock adapter executes phase callbacks and cancellation, and samples
// damped springs between beats. It deliberately does not emulate native frames.
export function mockReanimatedMotion() {
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((target, config, callback) => (
    { kind: 'timing', target, duration: config?.duration ?? 300, callback } as unknown as typeof target
  ));
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((target, config, callback) => (
    { kind: 'spring', target, duration: config?.damping === 6 ? 1800 : 320,
      damping: config?.damping ?? 18, stiffness: config?.stiffness ?? 220, callback } as unknown as typeof target
  ));
  jest.spyOn(Reanimated, 'withSequence').mockImplementation((...plans: unknown[]) => (
    { kind: 'sequence', plans } as unknown as ReturnType<typeof Reanimated.withSequence>
  ));
  const original = Reanimated.useSharedValue;
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial) => {
    const shared = original(initial);
    const ref = useRef<typeof shared | null>(null);
    if (ref.current === null) {
      let current = initial as Value;
      let run: { plan: Leaf; from: Value; start: number; timer: ReturnType<typeof setTimeout> } | null = null;
      const read = (): Value => {
        if (!run) return current;
        const elapsed = Math.max(0, Date.now() - run.start);
        let fraction = Math.min(1, elapsed / run.plan.duration);
        if (run.plan.kind === 'spring' && fraction < 1) {
          const damping = run.plan.damping! / 2;
          const omega = Math.sqrt(run.plan.stiffness! - damping * damping);
          const seconds = elapsed / 1000;
          fraction = 1 - Math.exp(-damping * seconds) * (Math.cos(omega * seconds) + damping / omega * Math.sin(omega * seconds));
        }
        const from = run.from, target = run.plan.target;
        if (typeof from === 'number' && typeof target === 'number') return from + (target - from) * fraction;
        const a = from as { x: number; y: number }, b = target as { x: number; y: number };
        return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
      };
      const stop = () => {
        current = read();
        if (run) clearTimeout(run.timer);
        run = null;
      };
      const start = (plans: Plan[]) => {
        const [plan, ...rest] = plans;
        if (!plan) return;
        if (plan.kind === 'sequence') { start([...plan.plans, ...rest]); return; }
        const leaf = { plan, from: current, start: Date.now(), timer: null as unknown as ReturnType<typeof setTimeout> };
        run = leaf;
        leaf.timer = setTimeout(() => {
          if (run !== leaf) return;
          current = plan.target;
          run = null;
          plan.callback?.(true);
          // A callback may have started a new animation on this same value.
          if (run === null) start(rest);
        }, plan.duration);
      };
      const write = (next: unknown) => {
        if (typeof next === 'function') next = next(read());
        stop();
        if (next && typeof next === 'object' && 'kind' in next) start([next as Plan]);
        else current = next as Value;
      };
      ref.current = new Proxy(shared, {
        get: (target, key) => key === 'value' || key === 'get' ? (key === 'get' ? read : read())
          : key === 'set' ? write : Reflect.get(target, key),
        set: (target, key, value) => { if (key === 'value') { write(value); return true; } return Reflect.set(target, key, value); },
      });
    }
    return ref.current;
  });
  jest.spyOn(Reanimated, 'cancelAnimation').mockImplementation((shared) => shared.set(shared.value));
}
