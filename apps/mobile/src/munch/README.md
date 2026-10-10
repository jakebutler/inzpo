Capture's waiting Baku uses the STAND-IN `chewLoop` and `chewVariation` frames
and UI-thread atlas playback from `/workspace/inzpo-munch`, branch
`cursor/inzpo-munch-spike`. These are the spike's 2D stopgap, not final 3D renders.
Every third 400ms chew uses the variation. Playback stops offscreen/backgrounded;
reduced motion renders a still and never decodes the atlas. Decode failure also
keeps the full-size still. No waiting haptics or artificial extraction delay.

Both playback and the reduced-motion still use the same Skia felt correction
to match the cream Baku poses, preserving knitted bands, eyes, blush and alpha.

`python3 apps/mobile/scripts/import-capture-baku.py` renders the original 48
chewLoop/chewVariation transforms from `assets/munch/chewing-source.png`, a
full-resolution transparent cutout with a faint pink trunk tip. Each density
is resampled directly from this source with premultiplied alpha and Lanczos;
no thresholded paper cutout or tint mask touches the tip.
The source was edited using the built-in imagegen tool. Prompt: preserve the
stand-in's pose, proportions, face and six knitted stripes; remove green tint
at the trunk tip, restore its faint pink blush, clean and anti-alias the feet
and lower cutout edge, remove ground/shadow, halos and stray fringe pixels;
keep a transparent background. A second cleanup pass removed stray fringe.

Decoded RGBA is 18.56MiB at 2x or 41.77MiB
at 3x, versus the spike's 229.71MiB
at 3x. Native memory/frame-rate profiling remains a device check.
The same script exports a tightly cropped 224pt login image at 1x/2x/3x from
`/workspace/inzpo/baku/states-v7/idle-cut.png` (672px wide at 3x).
