/** Quality-bar motion tokens. Durations are seconds (GSAP). */
export const MOTION = {
  tap: { duration: 0.12, ease: "power2.out" },
  small: { duration: 0.2, ease: "power2.inOut" },
  enter: { duration: 0.32, ease: "power3.out" },
  leave: { duration: 0.22, ease: "power2.in" },
  move: { duration: 0.28, ease: "power2.inOut" },
  reduced: { duration: 0.12, ease: "power1.out" },
} as const;

export const MOTION_CSS = {
  tapMs: 120,
  smallMs: 200,
  enterMs: 320,
  leaveMs: 220,
  reducedMs: 120,
  easeEnter: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeLeave: "cubic-bezier(0.4, 0, 1, 1)",
  easeMove: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function motionFor(kind: keyof typeof MOTION): { duration: number; ease: string } {
  if (prefersReducedMotion()) return MOTION.reduced;
  return MOTION[kind];
}
