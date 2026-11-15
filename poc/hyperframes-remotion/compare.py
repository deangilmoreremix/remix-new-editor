"""SSIM of Remotion-web-renderer stills vs native HyperFrames snapshots for each block/time.
Usage: REF=<dir with <block>/snap/frame-NN-at-<t>s.png> python3 compare.py  -> out/compare.json, out/pairs/<block>.png"""
import json, os, re, subprocess, glob
REF = os.environ['REF']; out = {}
os.makedirs('out/pairs', exist_ok=True)
for blk in sorted(os.listdir('out/blocks')):
    d = {}
    for f in sorted(glob.glob(f'{REF}/{blk}/snap/frame-*-at-*s.png')):
        t = re.search(r'at-([\d.]+)s\.png', f).group(1)
        mine = f'out/blocks/{blk}/t{t}.png'
        if not os.path.exists(mine): continue
        r = subprocess.run(['ffmpeg', '-loglevel', 'info', '-i', mine, '-i', f, '-filter_complex',
                            '[1:v]scale=iw*0+W:ih*0+H[r];[0:v][r]ssim'.replace('W', 'iw').replace('H', 'ih') if False else
                            '[1:v][0:v]scale2ref=flags=bicubic[r][m];[m][r]ssim', '-f', 'null', '-'], capture_output=True, text=True)
        m = re.search(r'All:([\d.]+)', r.stderr)
        d[t] = float(m.group(1)) if m else None
    if d: out[blk] = d
json.dump(out, open('out/compare.json', 'w'), indent=1)
print(len(out), 'blocks compared')
