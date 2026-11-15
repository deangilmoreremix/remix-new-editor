#!/usr/bin/env python3
"""Library thumbnails: for every enabled item, the production-path still (over black) with the most visible content, scaled to 320x180.
   python3 scripts/hyperframes/make-thumbs.py [--frames poc/hyperframes-remotion/out]  ->  public/hyperframes/thumbs/<id>.jpg"""
import argparse, glob, json, os
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser(); ap.add_argument('--frames', default=f'{R}/poc/hyperframes-remotion/out'); a = ap.parse_args()
nb = lambda im: sum(1 for p in im.convert('L').resize((160, 90)).tobytes() if p > 16)
os.makedirs(f'{R}/public/hyperframes/thumbs', exist_ok=True)
for it in json.load(open(f'{R}/src/lib/hyperframes/catalog.enabled.json'))['items']:
    k = it['id']; c = [f for d in ('final', 'default-all', 'p4') for f in glob.glob(f'{a.frames}/{d}/{k}/t*.png')]
    if not c: print('no frames for', k); continue
    im = Image.open(max(c, key=lambda f: nb(Image.open(f)))).convert('RGB'); W, H = 320, 180
    r = min(W / im.width, H / im.height); im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
    t = Image.new('RGB', (W, H), (0, 0, 0)); t.paste(im, ((W - im.width) // 2, (H - im.height) // 2)); t.save(f'{R}/public/hyperframes/thumbs/{k}.jpg', quality=82)
