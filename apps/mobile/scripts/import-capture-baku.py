#!/usr/bin/env python3
"""Export login art and render the stand-in chew motion from its clean source.

Requires Pillow. Sources default to the sibling source/spike workspaces.
"""
import argparse
import math
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path('/workspace/inzpo'))
parser.add_argument('--chewing-source', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/munch/chewing-source.png')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
idle = Image.open(args.source / 'baku/states-v7/idle-cut.png').convert('RGBA')
idle = idle.crop(idle.getbbox())
out = root / 'assets/baku-v7'
out.mkdir(exist_ok=True)
for density in (1, 2, 3):
    width = 224 * density
    idle.resize((width, round(width * idle.height / idle.width)), Image.Resampling.LANCZOS).save(
        out / f'idle-login{("@" + str(density) + "x") if density > 1 else ""}.png')

# Use the full-resolution cutout, never threshold paper from a 144px sprite.
# Its native pink tip is part of the source; the atlas has no dye shader.
source = Image.open(args.chewing_source).convert('RGBA')
# Ignore near-transparent isolated flecks when measuring the figure bounds.
bounds = source.getchannel('A').point(lambda a: 255 if a >= 32 else 0).getbbox()
if not bounds:
    raise ValueError('Chewing source has no figure')
source = source.crop(bounds)
out = root / 'assets/munch'
out.mkdir(exist_ok=True)
w, h, columns = 176, 144, 6
for density in (1, 2, 3):
    sheet = Image.new('RGBA', (columns * w * density, 8 * h * density))
    for index in range(48):
        t = (index % 24) / 23
        wobble = math.sin(t * 2 * math.pi)
        sx, sy, dx, dy = 1 + .025 * wobble, 1 - .03 * wobble, 0, 1.5 * wobble
        if index >= 24:
            sx += .018 * math.sin(t * 4 * math.pi)
            dx = 2 * math.sin(t * math.pi)
        fw, fh = 152 * sx, 119.43 * sy
        left, top = (w - fw) / 2 + dx, h - fh - 4 + dy
        # Resample directly from the high-resolution alpha source at every
        # density; RGBA resizing in Pillow uses premultiplied alpha.
        figure = source.resize((round(fw * density), round(fh * density)), Image.Resampling.LANCZOS)
        cell = Image.new('RGBA', (w * density, h * density))
        cell.alpha_composite(figure, (round(left * density), round(top * density)))
        sheet.paste(cell, ((index % columns) * w * density, (index // columns) * h * density))
        if index == 0:
            cell.save(out / f'still{("@" + str(density) + "x") if density > 1 else ""}.png')
    sheet.save(out / f'chew{("@" + str(density) + "x") if density > 1 else ""}.webp', lossless=True, method=6, exact=True)
print('Exported v7 idle and 48 clean chew frames at 1x/2x/3x.')
