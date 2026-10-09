#!/usr/bin/env python3
"""Reproduce tight, alpha-preserving v7 corner sprites. Requires Pillow.

python3 apps/mobile/scripts/baku-v7.py [--source /workspace/inzpo/baku/states-v7]
The source faces left; the component mirrors the entire figure and eyelids.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path('/workspace/inzpo/baku/states-v7'))
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / 'assets' / 'baku-v7'
output.mkdir(parents=True, exist_ok=True)
metadata = {}
for pose in ('idle', 'success'):
    source = Image.open(args.source / f'{pose}-cut.png').convert('RGBA')
    bounds = source.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'{pose} has no figure')
    figure = source.crop(bounds)
    height = round(62 * figure.height / figure.width)
    for density in (1, 2, 3):
        suffix = '' if density == 1 else f'@{density}x'
        figure.resize((62 * density, height * density), Image.Resampling.LANCZOS).save(
            output / f'{pose}{suffix}.png', optimize=True)
    metadata[pose] = {'source': f'{pose}-cut.png', 'alphaBounds': list(bounds), 'width': 62, 'height': height}
(output / 'crops.json').write_text(json.dumps(metadata, indent=2) + '\n')
