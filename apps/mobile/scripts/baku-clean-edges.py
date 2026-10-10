#!/usr/bin/env python3
"""Remove the dark v6 silhouette matte without changing framing or band masks.

Run from any directory (requires Pillow and numpy):
  python3 apps/mobile/scripts/baku-clean-edges.py

Inputs default to the pristine sprites at the pinned Git revision below, so
rerunning is byte-for-byte reproducible, even after committing the result.
Use --input-dir to process a separate pristine mobile sprite directory instead.
The designer sources are read-only. No native dependencies or export is needed.

The source has alpha-254 interior plateaus and black transparent contact-shadow
pixels. Treat alpha >= 250 as opaque *for boundary classification only*, and
exclude black shadow pixels; retain the exact original alpha for compositing.
Otherwise a literal alpha<255 mask would replace entire photographed stripes.
Every true partial silhouette pixel plus its 1px inward ring takes the nearest
interior colour. Its background comes from the nearest source-transparent pixel
in the pristine mobile image, preserving the paper and baked contact shadow.
The original matte supplies antialiasing; no additional feather is necessary.
"""
import argparse
from io import BytesIO
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

MOBILE = Path(__file__).resolve().parents[1]
REPO = MOBILE.parents[1]
POSES = ("idle", "chewing", "success", "error-brief", "error-photo", "empty", "404")
PAPER = (243, 238, 228)
# The original opaque sprite import. Pin rather than HEAD to prevent rerun drift.
INPUT_REVISION = "edfe24b9d20ebc5465a4f7ad6c328f65fe7957fc"


def nearest(targets, candidates):
    """Exact Euclidean nearest neighbour; row-major order breaks ties stably."""
    if not len(candidates):
        raise ValueError("Matte has no interior/background pixels")
    result = []
    for start in range(0, len(targets), 128):
        delta = targets[start:start + 128, None, :] - candidates[None, :, :]
        distance = np.sum(delta.astype(np.int32) ** 2, axis=2)
        result.append(candidates[np.argmin(distance, axis=1)])
    return np.concatenate(result) if result else np.empty((0, 2), dtype=int)


def boundary(source):
    alpha = source[:, :, 3]
    silhouette = alpha.copy()
    # Source shadow RGB is black; it is background, not dark felt to dilate.
    silhouette[source[:, :, :3].max(axis=2) <= 16] = 0
    silhouette[silhouette >= 250] = 255
    partial = (silhouette > 0) & (silhouette < 255)
    dilated = np.asarray(Image.fromarray(partial.astype(np.uint8) * 255)
                         .filter(ImageFilter.MaxFilter(3))) > 0
    ring = (silhouette == 255) & dilated
    interior = (silhouette == 255) & ~dilated
    targets = np.argwhere(partial | ring)
    inside = nearest(targets, np.argwhere(interior))
    outside = nearest(targets, np.argwhere(alpha == 0))
    return alpha, silhouette, targets, inside, outside


def clean(image, matte):
    alpha, _, targets, inside, outside = matte
    # Keep L shades as L and RGBA bases as RGBA, with unchanged dimensions.
    pixels = np.array(image)
    rgb = pixels[:, :, None] if pixels.ndim == 2 else pixels[:, :, :3]
    foreground = rgb[tuple(inside.T)].astype(float)
    background = rgb[tuple(outside.T)].astype(float)
    coverage = alpha[tuple(targets.T)][:, None] / 255
    before = rgb[tuple(targets.T)].astype(float)
    composited = np.rint(foreground * coverage + background * (1 - coverage)).astype(np.uint8)
    if pixels.ndim == 2:
        pixels[tuple(targets.T)] = composited[:, 0]
    else:
        pixels[targets[:, 0], targets[:, 1], :3] = composited
    # Deficit from the alpha-composited interior, in 8-bit channel units.
    deficit = np.maximum(composited.astype(float) - before, 0)
    return Image.fromarray(pixels), deficit


def pristine(name, input_dir, revision):
    if input_dir:
        return Image.open(input_dir / name)
    relative = (MOBILE / "assets/baku-v6" / name).relative_to(REPO)
    data = subprocess.check_output(["git", "show", f"{revision}:{relative}"], cwd=REPO)
    return Image.open(BytesIO(data))


def comparison(examples, destination):
    """Full idle sprites and top-ear silhouette crops, each enlarged to 288px."""
    sheet = Image.new("RGB", (1200, 1080), PAPER)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 18)
    draw.text((24, 14), "Baku edges — original / cleaned (same source alpha, dimensions and paper)", fill=(35, 32, 29), font=font)
    for density, (before, after) in examples.items():
        y = 70 + (density - 1) * 330
        draw.text((24, y), f"@{density}x ({48 * density}px)", fill=(35, 32, 29), font=font)
        for column, sprite in enumerate((before, after)):
            # Nearest enlargement makes individual antialiased asset pixels
            # reviewable; this is deliberately not a simulated Skia screenshot.
            full = sprite.convert("RGB").resize((260, 260), Image.Resampling.NEAREST)
            crop = sprite.crop((10 * density, 16 * density, 23 * density, 29 * density))
            crop = crop.convert("RGB").resize((260, 260), Image.Resampling.NEAREST)
            x = 24 + column * 570
            draw.text((x, y + 28), "Before" if column == 0 else "After", fill=(35, 32, 29), font=font)
            sheet.paste(full, (x, y + 56))
            sheet.paste(crop, (x + 278, y + 56))
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path("/workspace/inzpo/baku/assets/v6"))
    parser.add_argument("--input-dir", type=Path)
    parser.add_argument("--input-revision", default=INPUT_REVISION)
    parser.add_argument("--output-dir", type=Path, default=MOBILE / "assets/baku-v6")
    parser.add_argument("--review", type=Path, default=MOBILE / "shots/baku-edges-before-after.png")
    parser.add_argument("--fixture", type=Path, default=MOBILE / "tests/fixtures/baku-edge-mattes.png")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    # Original alpha (R) and silhouette classification (G), opaque B=255.
    # This compact fixture makes asset regression tests independent of designer
    # sources outside the repo. Tiles: pose, density, base/color, 144px square.
    fixture = Image.new("RGB", (288, len(POSES) * 3 * 144), (0, 0, 255))
    examples, deficits = {}, {density: [] for density in (1, 2, 3)}
    for pose_index, pose in enumerate(POSES):
        for density in (1, 2, 3):
            mattes = {}
            for kind_index, kind in enumerate(("", "-color")):
                source = np.asarray(Image.open(args.source_dir / f"baku-{pose}{kind}@{density}x.png").convert("RGBA"))
                matte = boundary(source)
                mattes[kind] = matte
                alpha, silhouette = matte[:2]
                tile = Image.fromarray(np.stack((alpha, silhouette, np.full_like(alpha, 255)), axis=2))
                fixture.paste(tile, (kind_index * 144, (pose_index * 3 + density - 1) * 144))
            for kind in ("", "-color", "-shade"):
                suffix = "" if density == 1 else f"@{density}x"
                name = f"baku-{pose}{kind}{suffix}.png"
                original = pristine(name, args.input_dir, args.input_revision)
                matte = mattes["-color" if kind == "-color" else ""]
                if original.size != (matte[0].shape[1], matte[0].shape[0]):
                    raise ValueError(f"Source/mobile framing mismatch: {name}")
                result, deficit = clean(original, matte)
                result.save(args.output_dir / name)
                if kind == "":
                    deficits[density].append(deficit.flatten())
                    if pose == "idle":
                        examples[density] = (original, result)
    args.fixture.parent.mkdir(parents=True, exist_ok=True)
    fixture.save(args.fixture)
    comparison(examples, args.review)
    for density, parts in deficits.items():
        values = np.concatenate(parts)
        print(f"@{density}x base edge deficit vs composited interior: mean {values.mean():.2f} -> 0.00, max {values.max():.0f} -> 0 channel levels")
    print(f"Cleaned {len(POSES) * 3 * 3} sprites; band masks untouched. Review: {args.review}")


if __name__ == "__main__":
    main()
