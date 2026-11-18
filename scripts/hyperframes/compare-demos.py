#!/usr/bin/env python3
"""SSIM of production-path stills (sandboxed preview frame) vs native HyperFrames snapshots, per item and sample time.
   python3 scripts/hyperframes/compare-demos.py --prod out/demo-prod --ref out/demo-native --out out/compare-demo.json [--ids a,b]"""
import argparse, glob, json, os, re, subprocess
from concurrent.futures import ThreadPoolExecutor
ap = argparse.ArgumentParser(); [ap.add_argument('--' + k, required=True) for k in ('prod', 'ref', 'out')]; ap.add_argument('--ids', default=''); a = ap.parse_args()
ids = [x for x in a.ids.split(',') if x] or sorted(d for d in os.listdir(a.prod) if os.path.isdir(f'{a.prod}/{d}'))
def one(blk):
    d = {}
    for f in sorted(glob.glob(f'{a.ref}/{blk}/snap/frame-*-at-*s.png')):
        t = float(re.search(r'at-([\d.]+)s\.png', f).group(1)); mine = next((p for p in glob.glob(f'{a.prod}/{blk}/t*.png') if abs(float(re.search(r't([\d.]+)\.png', p).group(1)) - t) < 0.011), None)
        if not mine: continue
        r = subprocess.run(['ffmpeg', '-loglevel', 'info', '-i', mine, '-i', f, '-filter_complex', '[1:v][0:v]scale2ref=flags=bicubic[r][m];[m][r]ssim', '-f', 'null', '-'], capture_output=True, text=True)
        m = re.search(r'All:([\d.]+)', r.stderr); d[str(t)] = float(m.group(1)) if m else None
    return blk, d
with ThreadPoolExecutor(4) as ex: out = {k: v for k, v in ex.map(one, ids) if v}
json.dump(out, open(a.out, 'w'), indent=1); print(len(out), 'items compared;', sum(1 for v in out.values() if min(x for x in v.values() if x is not None) >= 0.95), 'with min SSIM >= 0.95')
