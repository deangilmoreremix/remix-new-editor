#!/usr/bin/env python3
"""Promotes BLOCKS that ship their own folder (project.folder records from eval-enable.py) when every gate passes with fresh production-path evidence:
SSIM >= 0.95 vs native HyperFrames at every sample (native frame not blank), no adapter error, policy features clean, real full-length 1080p browser MP4 export OK at >= 3 fps
(under 8 fps = slower export label), and >= 1 editable field with a measured visible effect (or ready-to-use: no visible text and clearly visible). Existing enabled items are never touched.
   python3 scripts/hyperframes/enable-demos.py --eval-enabled <enabled with demo records> --orig-enabled <real enabled> --ssim cmp.json --editables e.json --effect eff.json \
       --defaults out/demo-prod --native out/demo-native --exports out/demo-exp/results.json --out-enabled <path> --out-classification <path> [--report r.json]"""
import argparse, json, os
from PIL import Image, ImageChops
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser()
for k in ('eval-enabled', 'orig-enabled', 'ssim', 'editables', 'effect', 'defaults', 'native', 'exports', 'out-enabled', 'out-classification'): ap.add_argument('--' + k, required=True)
ap.add_argument('--report', default=''); a = ap.parse_args(); MIN_FPS, SLOW_FPS = 3.0, 8.0
cls = json.load(open(f'{R}/src/lib/hyperframes/catalog.classification.json')); orig = json.load(open(a.orig_enabled)); ev = {i['id']: i for i in json.load(open(a.eval_enabled))['items'] if i.get('project', {}).get('folder') or i.get('project', {}).get('demo')}
man = {i['id']: i for i in json.load(open(f'{R}/src/lib/hyperframes/catalog.manifest.json'))['items']}
ssim = json.load(open(a.ssim)); ed = json.load(open(a.editables)); eff = json.load(open(a.effect)); res = {r['id']: r for r in json.load(open(f'{a.defaults}/results.json'))}; exp = {r['id']: r for r in json.load(open(a.exports))}
have = {i['id'] for i in orig['items']}; # WebGL / three.js are allowed when the production render matches native (>= 0.95) AND a real export succeeds: both are measured here with software WebGL. WebGPU cannot be verified in this browser.
BAD = ('webgpu', 'htmlInCanvas', 'video', 'audio', 'unseededRandom', 'infiniteRepeat')
def stills(d): return [Image.open(os.path.join(d, f)).convert('L').resize((240, 135)) for f in sorted(os.listdir(d)) if f.endswith('.png')] if os.path.isdir(d) else []
def nonblank(ims):
    best = 0.0
    for im in ims:
        px = im.tobytes(); med = sorted(px)[len(px) // 2]; best = max(best, sum(1 for p in px if abs(p - med) > 12) / len(px))
    return best
def motion(ims): return max([sum(1 for p in ImageChops.difference(x, y).tobytes() if p > 12) / (240 * 135) for x in ims for y in ims] or [0])
new = []; report = {}
for k, it in ev.items():
    if k in have: continue
    v = cls['items'][k]; blocked = []
    s = ssim.get(k); mn = min([x for x in (s or {}).values() if x is not None] or [0])
    if mn < 0.95: report[k] = f'worst-sample SSIM {mn:.3f} (< 0.95)'; continue
    r = res.get(k) or {}
    if r.get('fatal') or r.get('codeErrors') or any(l.startswith('[hyperframes]') for l in r.get('logs', [])): blocked.append('adapter errors in the production render')
    f = man[k].get('features', {}); blocked += [f'{b} feature' for b in BAD if f.get(b)]
    nat = nonblank(stills_native := [Image.open(os.path.join(a.native, k, 'snap', x)).convert('L').resize((240, 135)) for x in sorted(os.listdir(os.path.join(a.native, k, 'snap'))) if x.endswith('.png')]) if os.path.isdir(os.path.join(a.native, k, 'snap')) else 0
    if nat < 0.002: blocked.append('native reference is blank')
    ours = stills(f'{a.defaults}/{k}'); onb = nonblank(ours)
    if onb < 0.002: blocked.append('standalone output is (nearly) blank')
    e = exp.get(k)
    if not e: blocked.append('no real browser export run')
    elif not e.get('ok') or e.get('hfErrors'): blocked.append('browser export failed: ' + str(e.get('error') or e.get('hfErrors'))[:70])
    elif e.get('fps', 0) < MIN_FPS: blocked.append(f"export too slow ({e.get('fps')} fps)")
    good = [x for x in ed.get(k, {}).get('editables', []) if eff.get(k, {}).get(x['key'], {}).get('effective')]
    leaves = r.get('leaves') or []; ready = False
    if not good:
        ready = not leaves and onb >= 0.01
        if not ready: blocked.append('no editable field with a measured visible effect' if ed.get(k, {}).get('editables') else 'shows built-in content and exposes no editable field')
    elif leaves and not any(x['type'] == 'text' for x in good): blocked.append('shows built-in text that cannot be edited')
    if blocked: report[k] = '; '.join(blocked); continue
    rec = dict(it); rec['category'] = (rec.get('tags') or ['other'])[0]; rec['type'] = it.get('type', 'block'); rec['editables'] = good; rec['readyToUse'] = ready; rec['motion'] = 'static' if motion(ours) < 0.0005 else 'animated'
    if e['fps'] < SLOW_FPS: rec['slow'] = True
    new.append(rec)
    v.update(status='verified-export', enabled=True, enabledBlockedBy=[], viaFolder=True, reason='SSIM >= 0.95 at all samples against native HyperFrames (block loaded from its own pinned folder); real 1080p browser export OK')
    v['evidence'] = {**(v.get('evidence') or {}), 'viaDemoSsimMin': round(mn, 3), 'export': {'ok': True, 'fps': e['fps']}, 'nonBlank': round(onb, 4), 'kind': rec['motion']}
orig['items'] += new
from collections import Counter
cls['enabledCount'] = len(orig['items']); cls['totals'] = dict(Counter(v['status'] for v in cls['items'].values()))
for t in ('block', 'component', 'example'): cls['byType'][t] = dict(Counter(v['status'] for v in cls['items'].values() if v['type'] == t))
json.dump(orig, open(a.out_enabled, 'w'), indent=1); json.dump(cls, open(a.out_classification, 'w'), indent=1)
if a.report: json.dump(report, open(a.report, 'w'), indent=1)
print('promoted', len(new), '| held back', len(report)); print(Counter(x.split(';')[0][:60] for x in report.values()).most_common(8))
