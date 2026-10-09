#!/usr/bin/env python3
"""Deterministic STAND-INs, not final 3D art. Requires Pillow + numpy.
Run: python3 scripts/make-munch-standin.py. Outputs lossless alpha WebP.
Mask: R=role index/6, G=felt luminance, A=coverage. Max texture 3168px.
"""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/munch'
OUT.mkdir(exist_ok=True)
W, H, COLS, PER_PAGE = 176, 144, 6, 36
source = Image.open(ROOT / 'assets/baku-v6/baku-chewing-color@3x.png').convert('RGBA')
pixels = np.array(source)
# Remove only paper connected to the image border, retaining pale felt interior.
paper = np.max(np.abs(pixels[:, :, :3].astype(int) - [243, 238, 228]), axis=2) < 14
seen = np.zeros(paper.shape, dtype=bool)
stack = [(x, y) for y in range(144) for x in range(144) if x in (0,143) or y in (0,143)]
while stack:
    x, y = stack.pop()
    if not (0 <= x < 144 and 0 <= y < 144) or seen[y,x] or not paper[y,x]:
        continue
    seen[y,x] = True
    stack.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
pixels[seen, 3] = 0
base = Image.fromarray(pixels)
mask = np.zeros_like(pixels)
for band in range(1, 7):
    coverage = np.array(Image.open(ROOT / f'assets/baku-v6/baku-chewing-band{band}@3x.png').convert('L'))
    active = coverage > mask[:,:,3]
    mask[active,0] = round(band * 255 / 6)
    mask[active,1] = np.mean(pixels[:,:,:3],axis=2)[active].astype('uint8')
    mask[active,2] = 255
    mask[active,3] = coverage[active]
mask[:,:,3] = np.minimum(mask[:,:,3], pixels[:,:,3])
mask = Image.fromarray(mask)
# Crop the character (omit the little prop at the far left), then fit ~160pt wide.
bounds = (24, 55, 136, 143)
base, mask = base.crop(bounds), mask.crop(bounds)
clips = {'inhale':(0,48), 'chewLoop':(48,24), 'chewVariation':(72,24), 'sneeze':(96,36)}
frames = []
for name, (start,count) in clips.items():
    for i in range(count):
        t = i / max(1,count-1)
        if name == 'inhale':
            sx, sy, dx, dy = 1+.075*math.sin(t*math.pi/2), 1-.035*t, 0, 0
        elif name.startswith('chew'):
            wobble = math.sin(t*2*math.pi)
            sx, sy, dx, dy = 1+.025*wobble, 1-.03*wobble, 0, 1.5*wobble
            if name == 'chewVariation':
                sx += .018*math.sin(t*4*math.pi); dx = 2*math.sin(t*math.pi)
        else:
            recoil = math.sin(min(1,t*2)*math.pi) * (1-t)
            sx, sy, dx, dy = 1-.09*recoil, 1+.06*recoil, 9*recoil, -3*recoil
        fw, fh = 152*sx, 119.43*sy
        left, top = (W-fw)/2+dx, H-fh-4+dy
        idx = start+i
        anchor = lambda x,y: {'x':round(left+x*fw,4), 'y':round(top+y*fh,4)}
        frames.append({'page':idx//PER_PAGE, 'rect':{'x':(idx%PER_PAGE%COLS)*W,'y':(idx%PER_PAGE//COLS)*H,'width':W,'height':H}, 'snoutAnchor':anchor(.027,.64),'bellyAnchor':anchor(.61,.66), 'transform':[round(v,5) for v in (fw,fh,left,top)]})
for density in (2,3):
    for page in range(math.ceil(len(frames)/PER_PAGE)):
        subset = frames[page*PER_PAGE:(page+1)*PER_PAGE]
        size = (COLS*W*density, math.ceil(len(subset)/COLS)*H*density)
        sheets = [Image.new('RGBA',size), Image.new('RGBA',size)]
        for f in subset:
            fw,fh,left,top = f['transform']
            for sheet, img in zip(sheets,(base,mask)):
                resized = img.resize((round(fw*density),round(fh*density)),Image.Resampling.BICUBIC)
                sheet.alpha_composite(resized,(round((f['rect']['x']+left)*density), round((f['rect']['y']+top)*density)))
        for sheet,label in zip(sheets,('baku','stripes')):
            sheet.save(OUT/f'{label}-{page}@{density}x.webp',format='WEBP',lossless=True,method=6,exact=True)
for f in frames:
    del f['transform']
manifest = {'kind':'STAND-IN','fps':60,'frameSize':{'width':W,'height':H}, 'densities':[2,3], 'pageCount':4, 'clips':{name:{'start':s,'count':c,'loop':name.startswith('chew')} for name,(s,c) in clips.items()}, 'hapticFrames':{'inhale':[{'frame':0,'kind':'soft'},{'frame':16,'kind':'light'},{'frame':28,'kind':'medium'},{'frame':36,'kind':'medium'},{'frame':42,'kind':'heavy'}], 'chewLoop':[{'frame':6,'kind':'light'}], 'chewVariation':[{'frame':6,'kind':'light'}], 'sneeze':[{'frame':3,'kind':'rigid'}]}, 'frames':frames}
(ROOT/'src/munch/standin-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
photo = Image.open(ROOT/'../../public/sample/IMG_6208.jpg').convert('RGB')
photo.thumbnail((720,720))
photo.save(OUT/'test-house.jpg',quality=85)
print(f'Generated {len(frames)} stand-in frames at 2x/3x, 4 pages each + masks.')
