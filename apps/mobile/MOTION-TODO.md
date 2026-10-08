# Deferred native motion

- DONE: static per-stripe Skia tint using Designer’s fixed v6 base, shade and masks (`out = roleColor × shade/128`, coverage blend, base alpha preserved). Empty roles use undyed oatmeal `#E4D9C6`; unrevealed stripes retain the base knit. No-kit screens use the full-color sprite.
- Remaining: 180ms top-to-bottom stripe wipe.
- Separate googly-eye pupils with a damped spring (damping 6, stiffness 180).
- Idle breathing (scaleY 1–1.015, 2.4s), paused off-screen and disabled for reduced motion.
- Baku success hop, anticipation/landing squash, contact shadow and pupil jiggle. Current success pose holds 2s, then crossfades to idle over 150ms.
- Rive state machine `baku` with number input `pose` and trigger `hop`; requires a `.riv` asset and a development build. Use Skia tint if runtime color binding is unavailable.
- Full-screen `expo-camera` CameraView and 72pt shutter ring with safe-area controls. Current capture still uses `expo-image-picker`.
- Paper flash `#F3EEE4` at 35%, held 80ms then faded over 120ms; disabled under reduced motion.
- Frozen-frame shared-element hand-off (`sharedTransitionTag`), with a 200ms Android crossfade fallback if needed. Verify support in the installed Reanimated release before implementing.
- Photo pins/hairlines and actual color editing. `useResultSequence().markerStyle` exposes the marker beat; `EditSheetHandle.snapToPeek()` is the future pin-drag entry point.
- Loupe (96pt, 2.5× zoom, 56pt offset, edge-aware placement and ink crosshair). Feed quantized color changes into `haptics.selection(hex, reducedMotion)`: at most one tick/80ms, none under reduced motion.
- Kit overflow/export sheet: dynamic height and 52pt action rows.
- Photo collapse to 40% of its slot at largest Dynamic Type. Bands already wrap, grow and scroll with font scaling; hex text has no truncation limit.

## Current sequence

Tune `RESULT_TIMELINE` in `src/theme/motion.ts`: swallow at 0ms, bands at 120 + 60·i, landing haptic at 740ms, markers at 820ms, brief/buttons at 940ms, text fade ending at 1180ms. The landing beat uses the spec's nominal 320ms spring settling estimate. Reduced motion uses one 150ms fade and preserves the landing haptic.

Touch or scroll cancels the sequence and sets all final values. Skipping before landing suppresses the soft haptic; skipping afterward adds none. Pending data always keeps Save/Edit disabled. Device checks still needed for spring feel, sheet/keyboard gestures, VoiceOver/TalkBack, and the largest Dynamic Type sizes.
