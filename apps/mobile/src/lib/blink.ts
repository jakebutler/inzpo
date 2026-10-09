export const BLINK = { minimumMs: 4000, maximumMs: 6000, closeMs: 70, holdMs: 60, openMs: 90 } as const;

export function blinkDelay(random = Math.random): number {
  return BLINK.minimumMs + Math.max(0, Math.min(1, random())) * (BLINK.maximumMs - BLINK.minimumMs);
}

/** One pending timer, re-randomized after each blink; never a fixed interval. */
export function scheduleBlinks(blink: () => void, { reducedMotion = false, active = true, random = Math.random }: {
  reducedMotion?: boolean; active?: boolean; random?: () => number;
} = {}): () => void {
  if (reducedMotion || !active) return () => {};
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  function schedule() {
    timer = setTimeout(() => {
      if (cancelled) return;
      blink();
      if (!cancelled) schedule();
    }, blinkDelay(random));
  }
  schedule();
  return () => { cancelled = true; clearTimeout(timer); };
}
