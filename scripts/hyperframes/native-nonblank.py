#!/usr/bin/env python3
"""Largest fraction of non-black pixels in the native HyperFrames reference frames of each item. A native reference that is blank at every
sample cannot verify anything (blank-vs-blank gives SSIM 1.0), so such items are never marked verified.
   python3 scripts/hyperframes/native-nonblank.py --refs eval/ref,eval/refcomp,eval/refx --out nonblank.json"""
import argparse, glob, json, os
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--refs', required=True); ap.add_argument('--out', required=True); a = ap.parse_args()
out = {}
for root in a.refs.split(','):
    for d in sorted(os.listdir(root)):
        fs = glob.glob(f'{root}/{d}/snap/frame-*.png')
        if not fs: continue
        m = 0.0
        for f in fs:
            im = Image.open(f).convert('L').resize((480, 270)); m = max(m, sum(1 for p in im.tobytes() if p > 16) / (480 * 270))
        out[d] = round(m, 4)
json.dump(out, open(a.out, 'w'), indent=1); print(len(out), 'items;', sum(1 for v in out.values() if v < 0.003), 'blank at every sample')
