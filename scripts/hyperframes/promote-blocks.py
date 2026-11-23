#!/usr/bin/env python3
"""Promotes plain (single-file) BLOCKS that were evaluated through the production path, when every gate passes:
SSIM >= 0.95 vs native HyperFrames at every sample (native not blank), no adapter error, policy features clean (WebGL / three.js allowed: measured with software WebGL; WebGPU and
html-in-canvas are not), real full-length 1080p browser MP4 export >= 3 fps (< 8 fps = `slow` label), and either >= 1 editable text field with a measured visible effect or no visible text.
Inputs are the evaluation artefacts (see docs/hyperframes-timeline-integration.md, "Stage 3, part 3"):
   python3 scripts/hyperframes/promote-blocks.py --ids a,b --eval-enabled <temp enabled.json> --orig-enabled <real enabled.json> --ssim cmp.json --discover disc/results.json \
       --editables ed.json --effect eff.json --prod out/prod --exports exp/results.json --out-enabled <path> --out-classification <path> [--report r.json]
`--editables` maps block -> [{key,label,defaultValue,type,target}] (text leaves found by the production-path DISCOVER run, labelled by a person); only fields with a measured visible effect are kept."""
import argparse, json, os
from collections import Counter
from PIL import Image, ImageChops
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser()
for k in ('ids', 'eval-enabled', 'orig-enabled', 'ssim', 'discover', 'editables', 'effect', 'prod', 'exports', 'out-enabled', 'out-classification'): ap.add_argument('--' + k, required=True)
ap.add_argument('--report', default=''); a = ap.parse_args(); MIN_FPS, SLOW_FPS = 3.0, 8.0
cls = json.load(open(f'{R}/src/lib/hyperframes/catalog.classification.json')); orig = json.load(open(a.orig_enabled))
ev = {i['id']: i for i in json.load(open(a.eval_enabled))['items']}; man = {i['id']: i for i in json.load(open(f'{R}/src/lib/hyperframes/catalog.manifest.json'))['items']}
ssim = json.load(open(a.ssim)); ed = json.load(open(a.editables)); eff = json.load(open(a.effect)); disc = {r['id']: r for r in json.load(open(a.discover))}; exp = {r['id']: r for r in json.load(open(a.exports))}
have = {i['id'] for i in orig['items']}; BAD = ('webgpu', 'htmlInCanvas', 'video', 'audio', 'unseededRandom', 'infiniteRepeat')
def stills(d): return [Image.open(os.path.join(d, f)).convert('L').resize((240, 135)) for f in sorted(os.listdir(d)) if f.endswith('.png')] if os.path.isdir(d) else []
def nonblank(ims):
    best = 0.0
    for im in ims:
        px = im.tobytes(); med = sorted(px)[len(px) // 2]; best = max(best, sum(1 for p in px if abs(p - med) > 12) / len(px))
    return best
def motion(ims): return max([sum(1 for p in ImageChops.difference(x, y).tobytes() if p > 12) / (240 * 135) for x in ims for y in ims] or [0])
new = []; report = {}
for k in [x for x in a.ids.split(',') if x]:
    if k in have or k not in ev: continue
    v = cls['items'][k]; blocked = []
    mn = min([x for x in (ssim.get(k) or {}).values() if x is not None] or [0])
    if mn < 0.95: report[k] = f'worst-sample SSIM {mn:.3f} (< 0.95)'; continue
    r = disc.get(k) or {}
    if r.get('fatal') or r.get('codeErrors') or any(l.startswith('[hyperframes]') for l in r.get('logs', [])): blocked.append('adapter errors in the production render')
    blocked += [f'{b} feature' for b in BAD if man[k].get('features', {}).get(b)]
    ours = stills(f'{a.prod}/{k}'); onb = nonblank(ours)
    if onb < 0.002: blocked.append('output is (nearly) blank')
    e = exp.get(k)
    if not e: blocked.append('no real browser export run')
    elif not e.get('ok') or e.get('hfErrors'): blocked.append('browser export failed: ' + str(e.get('error') or e.get('hfErrors'))[:70])
    elif e.get('fps', 0) < MIN_FPS: blocked.append(f"export too slow ({e.get('fps')} fps)")
    good = [x for x in ed.get(k, []) if eff.get(k, {}).get(x['key'], {}).get('effective')]
    leaves = r.get('leaves') or []; ready = False
    if not good:
        ready = not leaves and onb >= 0.01
        if not ready: blocked.append('shows built-in text and exposes no editable field with a visible effect' if leaves else 'barely visible output')
    elif not any(x['type'] == 'text' for x in good) and leaves: blocked.append('shows built-in text that cannot be edited')
    if blocked: report[k] = '; '.join(blocked); continue
    rec = {kk: vv for kk, vv in ev[k].items() if kk != 'project'}; rec['category'] = (rec.get('tags') or ['other'])[0]; rec['type'] = 'block'; rec['editables'] = good; rec['readyToUse'] = ready; rec['motion'] = 'static' if motion(ours) < 0.0005 else 'animated'
    if e['fps'] < SLOW_FPS: rec['slow'] = True
    new.append(rec)
    v.update(status='verified-export', enabled=True, enabledBlockedBy=[], reason='SSIM >= 0.95 at all samples against native HyperFrames (production path, software WebGL where used); real 1080p browser MP4 export OK')
    v['evidence'] = {**(v.get('evidence') or {}), 'prodSsimMin': round(mn, 3), 'export': {'ok': True, 'fps': e['fps']}, 'nonBlank': round(onb, 4), 'kind': rec['motion']}
orig['items'] += new
cls['enabledCount'] = len(orig['items']); cls['totals'] = dict(Counter(x['status'] for x in cls['items'].values()))
for t in ('block', 'component', 'example'): cls['byType'][t] = dict(Counter(x['status'] for x in cls['items'].values() if x['type'] == t))
json.dump(orig, open(a.out_enabled, 'w'), indent=1); json.dump(cls, open(a.out_classification, 'w'), indent=1)
if a.report: json.dump(report, open(a.report, 'w'), indent=1)
print('promoted', len(new), '| held back', len(report)); print(Counter(x.split(';')[0][:60] for x in report.values()).most_common(8))
