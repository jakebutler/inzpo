Munch lab is a hidden, isolated Expo Go feasibility spike. Baku is a felt tapir; it uses generated **STAND-IN** frames, not final 3D art. No extraction API is called.

Open `/munch-lab`, or hold the **Inzpo** header title for 700ms. Entry and direct links are enabled in development or with `EXPO_PUBLIC_APP_VARIANT=preview` in the preview build/update environment. Production redirects to `/`.

When switching `EXPO_PUBLIC_APP_VARIANT` between local release exports, use `npx expo export --clear` (or clear the bundler cache for the Update export). Review found that an export without clearing reused the preceding preview gate. Preview iOS/Android bundles enable it; a clean production export disables it on both platforms.

On an SDK 57 Expo Go device:

1. Wait for **Start / replay** to enable. All four atlas pages, four stripe pages, and the photo decode first; every texture is drawn during warmup, followed by three UI frames before playback.
2. Try 0s (early resolution), 3s, and 15s (many chew cycles). Inhale lasts 800ms; chew finishes its current cycle before sneeze. Every third chew cycle varies.
3. Switch kit while playing to check live six-stripe color blending. Five chips follow the first five shared color roles; the sixth role colors the remaining stripe.
4. Tap the scene or background to skip to all landed chips. Controls remain usable during playback. Replay cancels the previous extraction timer.
5. Enable OS Reduce Motion and replay: essence disappears, haptics stop, chips fade at their slots in 180ms. Toggle it while playing too. Blur/background stops the frame callback; refocus/resume excludes paused time from playback and dropped frames. Haptics queued for more than 100ms are discarded rather than replayed in a burst.
6. Replay repeatedly, then close during inhale/chew/sneeze. Check that no old extraction callback or haptic escapes the cancelled run.

The overlay samples UI frame callbacks every 500ms and counts missed **60Hz** deadlines. It measures UI clock cadence, not GPU presentation. A 120Hz device may report ~120fps while the atlas still samples 60 animation frames per second. Record device/OS, Expo Go version, density, run duration, steady FPS and cumulative drops; use device profiling to confirm presented frames and memory. This workspace has no attached device, so 60fps in Expo Go has **not** been measured here.

Regenerate with `python3 scripts/make-munch-standin.py` (Pillow + numpy). Source is `assets/baku-v6/baku-chewing*.png` plus a checked-in sample house photo. Output is 132 lossless alpha WebP frames at 2x/3x in four pages (maximum dimension 3168px). Both profiles ship; only the device's selected density decodes. At 3x, each set has three 3168×2592 pages and one 3168×1728 page: 120,434,688 decoded RGBA bytes for sprites and the same for masks, totaling **240,869,376 bytes (229.71MiB)**. At 2x the combined total is 107,053,056 bytes (102.09MiB). This is a large resident set for a phone; one additional full CPU/GPU copy brings the 3x atlas allocation to 459.42MiB. WebP compression reduces packaged bytes, not decoded memory. This spike needs device memory profiling before adopting its eager preload in production.

`standin-manifest.json` is generated plain JSON, exposed through `manifest.ts` and `types.ts`. Rects and anchors are in logical points; the renderer multiplies rects by the selected density. Stripe masks encode role ID in red (`role/6`), felt luminance in green, and coverage in alpha; they follow exactly the sprite's transforms. SkSL extracts each role and Skia's `modulate` color blend applies the current kit color. Replace the JSON and atlases with final renders using the same contract.

Only the Reanimated UI frame clock chooses frames and updates anchors, particles and chip transforms. JS receives sparse haptics and telemetry; it resolves the fake extraction Promise. Chips emit 50ms into sneeze, stagger by 75ms, spin on bounded arcs and land within 1200ms, with 3% travel overshoot.

Validation: `npx tsc --noEmit`, `npx jest --maxWorkers=2`, `npx expo lint`. Sequence tests cover manifest bounds/alpha assets, early/late and exact-boundary resolution, variations, skips, haptics, continuous 40/50/60/120Hz drop accounting, drift and landing bounds. Player tests cover callback stability, focus/background/unmount, timer cancellation, queued haptics and Reduce Motion changes. Entry tests cover the production/preview gate and title long press. CanvasKit tests compile the actual mask shader and verify premultiplied role IDs, frame offsets, shading and color blending.
