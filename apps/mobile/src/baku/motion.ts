/** Seconds. The study and capture use the same adjustable choreography.
 * Resolve captured defaults inside worklet bodies: parameter initializers run
 * before Worklets hydrates this.__closure on the UI runtime. */
export const TIMING = { inhale: 1.2, chew: 1.3, loop: 0.65, anticipation: 0.62, release: 0.22, landing: 0.86 };
export const clamp = (v: number, min = 0, max = 1) => { "worklet"; return Math.min(max, Math.max(min, v)); };
const smooth = (v: number) => { "worklet"; const x = clamp(v); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => { "worklet"; return a + (b - a) * smooth(t); };

export type Beat = "notice" | "inhale" | "chew" | "anticipation" | "sneeze" | "landing" | "done";
export interface Pose {
  belly: number; lean: number; cheekL: number; cheekR: number; fullness: number;
  snout: number; trunkReach: number; trunkFlare: number; tremble: number; ears: number; feet: number; squash: number;
  closed: number; happy: number; breath: number; beat: Beat;
}

/** A slow palette gets its own inhale after the waiting loop. */
export function colorInhaleAt(readyAt: number, timingOverride?: typeof TIMING) {
  'worklet';
  const timing = timingOverride ?? TIMING;
  return readyAt > 0.22 ? Math.max(timing.inhale, readyAt) : 0;
}

/** Success follows the real-color inhale and a full chew boundary. */
export function anticipationAt(readyAt: number, timingOverride?: typeof TIMING) {
  "worklet";
  const timing = timingOverride ?? TIMING;
  const earliest = timing.inhale + timing.chew;
  const colorEnd = colorInhaleAt(readyAt, timing) + timing.inhale + 0.15;
  return earliest + Math.ceil(Math.max(0, colorEnd - earliest) / timing.loop) * timing.loop;
}
export function durationFor(readyAt: number, timingOverride?: typeof TIMING) {
  "worklet";
  const timing = timingOverride ?? TIMING;
  return anticipationAt(readyAt, timing) + timing.anticipation + timing.release + timing.landing;
}

/** True extracted colors finish filling the knit before the sneeze, even when
 * readiness arrives late. Replays and backwards scrubbing reset the reveal.
 */
export function coatFillAt(time: number, readyAt: number | null, timingOverride?: typeof TIMING) {
  "worklet";
  const timing = timingOverride ?? TIMING;
  if (readyAt === null) return 0;
  const colorStart = colorInhaleAt(readyAt, timing);
  const start = colorStart + 0.25;
  const end = colorStart + timing.inhale + 0.28;
  return smooth((time - start) / (end - start));
}

/** Pure pose sampling makes backwards scrubbing and replay identical to playback. */
export function poseAt(time: number, readyAt: number | null, timingOverride?: typeof TIMING): Pose {
  "worklet";
  const timing = timingOverride ?? TIMING;
  const t = Math.max(0, time);
  const p: Pose = { belly: 0, lean: 0, cheekL: 0, cheekR: 0, fullness: 0, snout: 0, trunkReach: 0, trunkFlare: 0, tremble: 0, ears: 0, feet: 0, squash: 0, closed: 0, happy: 0, breath: 0, beat: "notice" };
  // Lift, reach, and hold the nostril toward the photo; release the bend gently
  // across the inhale/chew boundary instead of snapping back with that beat.
  p.trunkReach = smooth((t - 0.08) / 0.66) * (1 - smooth((t - timing.inhale + 0.06) / 0.42));
  const stop = readyAt === null ? Infinity : anticipationAt(readyAt, timing);
  if (t < timing.inhale) {
    const b = smooth((t - 0.18) / (timing.inhale - 0.18));
    Object.assign(p, { belly: b, lean: smooth(t / 0.5) * 0.7, snout: smooth(t / 0.65) * 0.65,
      fullness: smooth((t - 0.4) / 0.65), ears: Math.sin(b * Math.PI) * 0.6,
      breath: smooth((t - 0.12) / 0.25) * (1 - smooth((t - 1.03) / 0.17)), beat: t < 0.22 ? "notice" : "inhale" });
  } else if (t < stop) {
    const cycle = (t - timing.inhale) / timing.loop;
    const entry = (t - timing.inhale) / 0.16;
    // Asymmetric double-chew; mouth stays full even at each trough.
    const angle = cycle * Math.PI * 2;
    const chew = Math.sin(angle + 0.18 * Math.sin(angle * 2)) * (0.9 + 0.1 * Math.cos(cycle * Math.PI));
    Object.assign(p, { belly: 1 + 0.018 * Math.sin(cycle * Math.PI), fullness: 1,
      cheekL: mix(0, 0.52 + 0.48 * chew, entry), cheekR: mix(0, 0.5 - 0.42 * chew, entry),
      snout: mix(0.65, 0.36 + 0.05 * Math.sin(cycle * Math.PI * 4 + 0.4), entry),
      lean: mix(0.7, 0.16 + 0.07 * Math.sin(cycle * Math.PI * 2 + 0.6), entry),
      ears: 0.12 * Math.sin(cycle * Math.PI * 2 - 0.4), beat: "chew" });
    if (readyAt !== null && colorInhaleAt(readyAt, timing) > 0) {
      const local = t - colorInhaleAt(readyAt, timing);
      const breath = smooth((local - .12) / .25) * (1 - smooth((local - timing.inhale + .17) / .17));
      const reach = smooth((local - .08) / .66) * (1 - smooth((local - timing.inhale + .06) / .42));
      p.trunkReach = Math.max(p.trunkReach, reach);
      p.breath = breath;
      p.lean = mix(p.lean, .7, breath);
      p.snout = mix(p.snout, .65, breath);
      if (breath > 0) p.beat = 'inhale';
    }
  } else {
    const a = t - stop;
    if (a < timing.anticipation) {
      const k = a / timing.anticipation;
      Object.assign(p, { belly: mix(1, 1.14, k), fullness: 1, cheekL: mix(0.52, 0.7, k), cheekR: mix(0.5, 0.7, k),
        lean: mix(0.18, -0.82, k), snout: mix(0.38, -0.8, k), closed: smooth((k - 0.12) / 0.22),
        ears: mix(0, -0.6, k), squash: smooth(k) * -0.25,
        tremble: Math.sin(a * 95) * smooth((k - 0.45) / 0.4), beat: "anticipation" });
    } else {
      const r = a - timing.anticipation;
      const snap = smooth(r / 0.085);
      const recover = smooth((r - 0.13) / (timing.release + timing.landing - 0.13));
      Object.assign(p, { belly: mix(1.14, 0.06, snap), fullness: 1 - smooth(r / 0.2),
        lean: mix(-0.82, 1.7, snap) * (1 - recover), snout: mix(-0.8, 1, snap) * (1 - recover),
        trunkReach: 0.94 * snap * (1 - smooth((r - 0.36) / 0.5)),
        trunkFlare: snap * (1 - smooth((r - 0.32) / 0.32)),
        squash: Math.sin(clamp(r / 0.36) * Math.PI) * 0.85,
        ears: Math.sin(clamp((r - 0.065) / 0.6) * Math.PI * 2) * Math.exp(-r * 2),
        feet: Math.sin(clamp((r - 0.03) / 0.42) * Math.PI) * 0.75,
        tremble: Math.sin(r * 110) * (1 - smooth(r / 0.24)),
        closed: 1, happy: smooth((r - 0.32) / 0.16),
        beat: r < timing.release ? "sneeze" : r < timing.release + timing.landing ? "landing" : "done" });
    }
  }
  return p;
}

/** Quiet intake while the upload is in flight; cheeks stay empty until chewing. */
export function intakePoseAt(time: number): Pose {
  'worklet';
  const p = poseAt(0, null);
  const reach = smooth(time / .5);
  Object.assign(p, { lean: .32 * reach, snout: .25 * reach, trunkReach: .58 * reach,
    trunkFlare: (.22 + .045 * Math.sin(time * 3)) * reach,
    belly: .035 * Math.sin(time * 2.4), ears: .07 * Math.sin(time * 2), beat: 'inhale' });
  return p;
}

export function performancePoseAt(time: number, readyAt: number | null, intakeTime: number, intakeBlend: number): Pose {
  'worklet';
  const p = poseAt(time, readyAt);
  if (intakeBlend <= 0) return p;
  const intake = intakePoseAt(intakeTime);
  if (intakeBlend >= 1) return intake;
  const blend = clamp(intakeBlend);
  for (const key of ['belly', 'lean', 'cheekL', 'cheekR', 'fullness', 'snout', 'trunkReach', 'trunkFlare',
    'tremble', 'ears', 'feet', 'squash', 'closed', 'happy', 'breath'] as const) {
    p[key] += (intake[key] - p[key]) * blend;
  }
  if (blend > .5) p.beat = 'inhale';
  return p;
}

export const SNOUT = { x: 0.203, y: 0.744 };
// A second point inside the trunk gives the moving nostril's exit direction.
export const SNOUT_INNER = { x: 0.245, y: 0.65 };
export const TEXTURE_INSET = 0.07;
export const TEXTURE_SCALE = 0.86;
const influence = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => { "worklet";
  const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  return d >= 1 ? 0 : (1 - d) ** 2;
};

/** A moving local bend lifts the tip before extending it toward the photo.
 * Small successive warps keep the root attached and avoid folding the felt
 * surface when the tip travels farther than a single weighted offset allows.
 */
function reachTrunk(x: number, y: number, amount: number) {
  "worklet";
  if (amount <= 0) return { x, y };
  const steps = 10, step = amount / steps;
  for (let i = 0; i < steps; i++) {
    const a = i * step * Math.PI / 2, b = (i + 1) * step * Math.PI / 2;
    const cx = SNOUT.x - 0.12 * (1 - Math.cos(a)), cy = SNOUT.y - 0.18 * Math.sin(a);
    const weight = influence(x, y, cx, cy, 0.21, 0.27);
    if (weight === 0) continue;
    const turn = 0.9 * step * weight;
    // Texture is 3:2: rotate in image pixels so the nostril doesn't squash.
    const u = (x - cx) * 1.5, v = y - cy;
    x = cx + (u * Math.cos(turn) - v * Math.sin(turn)) / 1.5
      - 0.12 * (Math.cos(a) - Math.cos(b)) * weight;
    y = cy + u * Math.sin(turn) + v * Math.cos(turn)
      - 0.18 * (Math.sin(b) - Math.sin(a)) * weight;
  }
  return { x, y };
}

/** One connected mesh: independent soft weights, no cut edges or sliding seams. */
export function deform(x: number, y: number, p: Pose) {
  "worklet";
  let dx = 0, dy = 0;
  const belly = influence(x, y, 0.55, 0.61, 0.48, 0.39);
  dx += (x - 0.55) * p.belly * 0.19 * belly;
  dy += (y - 0.65) * p.belly * 0.12 * belly;
  const head = influence(x, y, 0.36, 0.42, 0.36, 0.48);
  dx -= p.lean * 0.035 * head;
  dy -= p.lean * 0.012 * head;
  const near = influence(x, y, 0.44, 0.64, 0.15, 0.19);
  dx += (x - 0.35) * p.cheekL * 0.33 * near;
  dy += (y - 0.50) * p.cheekL * 0.32 * near;
  const far = influence(x, y, 0.21, 0.54, 0.11, 0.18);
  dx -= p.cheekR * 0.022 * far;
  dy += p.cheekR * 0.018 * far;
  const nose = influence(x, y, 0.23, 0.65, 0.20, 0.25);
  dx -= (Math.max(0, p.snout) * 0.024 + p.tremble * 0.0035) * nose;
  dy -= (Math.max(0, p.snout) * 0.044 - p.tremble * 0.002) * nose;
  if (p.snout < 0) {
    dx += (0.34 - x) * -p.snout * 0.38 * nose;
    dy += (0.52 - y) * -p.snout * 0.34 * nose;
  }
  for (const [cx, cy, sign] of [[0.31, 0.16, -1], [0.535, 0.16, 1]]) {
    const ear = influence(x, y, cx, cy, 0.105, 0.19);
    dx += sign * p.ears * 0.018 * ear;
    dy += p.ears * 0.023 * ear;
  }
  const feet = influence(x, y, 0.52, 0.93, 0.30, 0.12);
  dx += p.feet * 0.025 * feet;
  dy -= p.feet * 0.012 * feet;
  const planted = smooth((0.99 - y) / 0.5);
  dx -= p.lean * 0.018 * planted;
  dx += (x - 0.56) * p.squash * 0.07 * planted;
  dy += (0.93 - y) * p.squash * 0.06;
  const flare = p.trunkFlare * 0.32 * influence(x, y, SNOUT.x, SNOUT.y, 0.095, 0.12);
  const trunk = reachTrunk(x + (x - SNOUT.x) * flare, y + (y - SNOUT.y) * flare, p.trunkReach);
  return { x: TEXTURE_INSET + (trunk.x + dx) * TEXTURE_SCALE, y: TEXTURE_INSET + (trunk.y + dy) * TEXTURE_SCALE };
}

export function validPalette(value: unknown): value is string[] {
  "worklet";
  return Array.isArray(value) && value.length > 0 && value.length <= 7 && value.every(c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c));
}
