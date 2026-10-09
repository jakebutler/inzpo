import * as ExpoHaptics from 'expo-haptics';

export const HAPTIC_BUDGET_MS = 300;
const LOUPE_TICK_MS = 80;

type Driver = Pick<typeof ExpoHaptics, 'impactAsync' | 'notificationAsync' | 'selectionAsync'>;

// Injectable driver and clock keep tests independent of the native module.
export function createHaptics(driver: Driver = ExpoHaptics, now: () => number = () => Date.now()) {
  let lastEvent = -Infinity;
  let lastTick = -Infinity;
  let lastHex: string | null = null;

  function event(fire: () => Promise<void>) {
    const time = now();
    if (time - lastEvent < HAPTIC_BUDGET_MS) return Promise.resolve();
    lastEvent = time;
    // Haptics must never turn a successful data operation into an error.
    try { return fire().catch(() => undefined); }
    catch { return Promise.resolve(); }
  }

  return {
    light: () => event(() => driver.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),
    soft: () => event(() => driver.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Soft)),
    success: () => event(() => driver.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
    error: () => event(() => driver.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error)),
    // TODO(motion): Wire quantized loupe samples to these separate 80ms ticks.
    selection(hex: string, reducedMotion: boolean) {
      if (reducedMotion) return Promise.resolve();
      const normalized = hex.toUpperCase();
      const time = now();
      if (normalized === lastHex || time - lastTick < LOUPE_TICK_MS) return Promise.resolve();
      lastHex = normalized;
      lastTick = time;
      try { return driver.selectionAsync().catch(() => undefined); }
      catch { return Promise.resolve(); }
    },
  };
}

// One budget across all screens, including reduced-motion mode.
export const haptics = createHaptics();
