#!/usr/bin/env python3
"""ADDITIVE promotion of items that were verified (SSIM vs native HyperFrames >= 0.95, real browser export OK) and blocked ONLY by the 8 fps export rule.
New rule: export >= 3 fps is enough; items under 8 fps are enabled and flagged `slow` (the card says "slower export"). Every other gate is re-checked here with
fresh production-path measurements: no adapter error, non-blank, and >= 1 editable field with a measured visible effect (or an explicit ready-to-use: no visible text and clearly visible).
Existing enabled items are never touched.
  python3 scripts/hyperframes/enable-slow.py --eval-enabled <temp enabled.json from eval-enable.py> --orig-enabled <real enabled.json> --editables e.json --effect eff.json \
      --defaults out/slow-default --out-enabled src/lib/hyperframes/catalog.enabled.json --out-classification src/lib/hyperframes/catalog.classification.json"""
import argparse, json, os
from PIL import Image, ImageChops
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser()
for k in ('eval-enabled', 'orig-enabled', 'editables', 'effect', 'defaults', 'out-enabled', 'out-classification'): ap.add_argument('--' + k, required=True)
a = ap.parse_args(); MIN_FPS, SLOW_FPS = 3.0, 8.0
cls = json.load(open(f'{R}/src/lib/hyperframes/catalog.classification.json')); orig = json.load(open(a.orig_enabled)); ev = {i['id']: i for i in json.load(open(a.eval_enabled))['items']}
ed = json.load(open(a.editables)); eff = json.load(open(a.effect)); res = {r['id']: r for r in json.load(open(f'{a.defaults}/results.json'))}
have = {i['id'] for i in orig['items']}
def stills(i): d = f'{a.defaults}/{i}'; return [Image.open(os.path.join(d, f)).convert('L').resize((240, 135)) for f in sorted(os.listdir(d)) if f.endswith('.png')] if os.path.isdir(d) else []
def nonblank(i): return max([sum(1 for p in im.tobytes() if p > 16) / (240 * 135) for im in stills(i)] or [0.0])
def motion(i):
    ims = stills(i); return max([sum(1 for p in ImageChops.difference(x, y).tobytes() if p > 12) / (240 * 135) for x in ims for y in ims] or [0])
new = []; report = {}
for k, v in cls['items'].items():
    b = v.get('enabledBlockedBy') or []
    if v['status'] != 'verified-export' or v.get('enabled') or k in have or not b or any(not x.startswith('export throughput') for x in b): continue
    fps = (v['evidence'].get('export') or {}).get('fps', 0)
    if fps < MIN_FPS: report[k] = f'export too slow ({fps} fps)'; continue
    r = res.get(k) or {}; blocked = []
    if k not in ev: blocked.append('not evaluated')
    if r.get('fatal') or r.get('codeErrors') or any('error' in str(l).lower() for l in r.get('logs', [])): blocked.append('adapter errors in the production render')
    onb = nonblank(k)
    if onb < 0.002: blocked.append('standalone output is (nearly) blank')
    good = [f for f in ed.get(k, {}).get('editables', []) if eff.get(k, {}).get(f['key'], {}).get('effective')]
    leaves = r.get('leaves') or []; ready = False
    if not good:
        ready = not leaves and onb >= 0.01
        if not ready: blocked.append('no editable field with a measured visible effect' if ed.get(k, {}).get('editables') else 'shows built-in content and exposes no editable field')
    elif leaves and not any(f['type'] == 'text' for f in good): blocked.append('shows built-in text that cannot be edited')
    if blocked: report[k] = '; '.join(blocked); continue
    rec = dict(ev[k]); it = rec; it['category'] = (it.get('tags') or ['other'])[0]; it['editables'] = good; it['readyToUse'] = ready; it['motion'] = 'static' if motion(k) < 0.0005 else 'animated'
    if fps < SLOW_FPS: it['slow'] = True
    new.append(it); v['evidence']['nonBlank'] = round(onb, 4)
    v['enabled'] = True; v['enabledBlockedBy'] = []; v['evidence']['kind'] = it['motion']
    if it.get('slow'): v['slow'] = True
orig['items'] += new
cls['enabledCount'] = len(orig['items'])
json.dump(orig, open(a.out_enabled, 'w'), indent=1); json.dump(cls, open(a.out_classification, 'w'), indent=1)
print('promoted', len(new)); print('still held back:', json.dumps(report, indent=1))
