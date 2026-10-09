Capture's waiting Baku uses the STAND-IN `chewLoop` and `chewVariation` frames
and UI-thread atlas playback from `/workspace/inzpo-munch`, branch
`cursor/inzpo-munch-spike`. These are the spike's 2D stopgap, not final 3D renders.
Every third 400ms chew uses the variation. Playback stops offscreen/backgrounded;
reduced motion renders a still and never decodes the atlas. Decode failure also
keeps the full-size still. No waiting haptics or artificial extraction delay.

`python3 scripts/import-capture-baku.py` repacks the 48 unchanged frames into one
6×8 atlas at 2x/3x with a downsampled 1x export, omitting the spike's inhale,
sneeze, masks and sample photo. Decoded RGBA is 18.56MiB at 2x or 41.77MiB
at 3x, versus the spike's 229.71MiB
at 3x. Native memory/frame-rate profiling remains a device check.
The same script exports a tightly cropped 224pt login image at 1x/2x/3x from
`/workspace/inzpo/baku/states-v7/idle-cut.png` (672px wide at 3x).
