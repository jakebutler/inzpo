#!/usr/bin/env python3
"""Export login art and repack the munch spike's unchanged chew frames.

Requires Pillow. Sources default to the sibling source/spike workspaces.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path('/workspace/inzpo'))
parser.add_argument('--spike', type=Path, default=Path('/workspace/inzpo-munch'))
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

spike = args.spike / 'apps/mobile'
manifest = json.loads((spike / 'src/munch/standin-manifest.json').read_text())
frames = []
for clip in ('chewLoop', 'chewVariation'):
    definition = manifest['clips'][clip]
    frames.extend(manifest['frames'][definition['start']:definition['start'] + definition['count']])
out = root / 'assets/munch'
out.mkdir(exist_ok=True)
w, h, columns = 176, 144, 6
for density in (1, 2, 3):
    sheet = Image.new('RGBA', (columns * w * density, 8 * h * density))
    source_density = max(2, density)
    pages = {}
    for index, frame in enumerate(frames):
        page = frame['page']
        if page not in pages:
            pages[page] = Image.open(spike / f'assets/munch/baku-{page}@{source_density}x.webp')
        r = frame['rect']
        cell = pages[page].crop(tuple(v * source_density for v in (r['x'], r['y'], r['x'] + w, r['y'] + h)))
        if density != source_density:
            cell = cell.resize((w * density, h * density), Image.Resampling.LANCZOS)
        sheet.paste(cell, ((index % columns) * w * density, (index // columns) * h * density))
        if index == 0:
            cell.save(out / f'still{("@" + str(density) + "x") if density > 1 else ""}.png')
    sheet.save(out / f'chew{("@" + str(density) + "x") if density > 1 else ""}.webp', lossless=True, method=6, exact=True)
print('Exported v7 idle and 48 chew frames at 1x/2x/3x.')
