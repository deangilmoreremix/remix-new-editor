#!/usr/bin/env python3
"""Classifies COMPONENTS and STARTER PROJECTS from measured production-path evidence and (only if every gate passes) appends them to the
enabled list. Run after classify.py (which handles blocks).
  python3 scripts/hyperframes/classify-extras.py --components-ssim a.json --examples-ssim b.json --results r1.json[,r2.json] \
      --editables e.json --effect eff.json --export exp.json --default-dir out/default-all
Gates for enabling (all required): SSIM >= 0.95 vs native HyperFrames at every sample; no adapter errors; policy features clean (no WebGL/three/
WebGPU/audio/video/unseeded random/remote assets); real browser MP4 export succeeded at >= 8 fps; and either >= 1 editable field with a measured visible
effect or an explicit ready-to-use mark (nothing customer-specific is visible). Static components (no motion between samples) are NOT penalised."""
import argparse, json, os
from PIL import Image, ImageChops
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser(); ap.add_argument('--blocks', default='', help='comma list of block ids re-evaluated through the production path (recovered by adapter improvements)')
for k in ('components-ssim', 'examples-ssim', 'results', 'editables', 'effect', 'export', 'default-dir', 'upstream', 'native-nonblank'): ap.add_argument('--' + k, required=True)
a = ap.parse_args()
cls = json.load(open(f'{R}/src/lib/hyperframes/catalog.classification.json')); en = json.load(open(f'{R}/src/lib/hyperframes/catalog.enabled.json'))
man = {i['id']: i for i in json.load(open(f'{R}/src/lib/hyperframes/catalog.manifest.json'))['items']}
ssim = {**json.load(open(a.components_ssim)), **json.load(open(a.examples_ssim))}
res = {}
for f in a.results.split(','):
    for r in json.load(open(f)): res[r['id']] = r
nb = json.load(open(a.native_nonblank)); edit = json.load(open(a.editables)); eff = json.load(open(a.effect)); exp = {r['id']: r for r in json.load(open(a.export))}
fmt = lambda t: '%g' % t
def motion(bid):
    d = f'{a.default_dir}/{bid}'
    try: ims = [Image.open(os.path.join(d, f)).convert('L').resize((240, 135)) for f in sorted(os.listdir(d)) if f.endswith('.png')]
    except Exception: return None
    return max([sum(1 for p in ImageChops.difference(x, y).tobytes() if p > 12) / (240 * 135) for x in ims for y in ims] or [0])
def ours_nonblank(bid):
    d = f'{a.default_dir}/{bid}'; best = 0.0
    try:
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'): best = max(best, sum(1 for p in Image.open(os.path.join(d, f)).convert('L').resize((240, 135)).tobytes() if p > 16) / (240 * 135))
    except Exception: return 0.0
    return best
BAD = ('webgl', 'three', 'webgpu', 'htmlInCanvas', 'video', 'audio', 'unseededRandom', 'infiniteRepeat')
newitems = []
for k, it in man.items():
    if (it['type'] not in ('component', 'example') and k not in a.blocks.split(',')) or k not in ssim: continue
    v = cls['items'][k]; s = ssim[k]; xs = [x for x in (s.get('min') if isinstance(s, dict) and 'min' in s else None, ) if x is not None]
    mn = s['min'] if isinstance(s, dict) and 'min' in s else min(x for x in s.values() if x is not None)
    errs = (s.get('errs') if isinstance(s, dict) else None) or [l for l in (res.get(k, {}).get('logs') or []) if l.startswith('[hyperframes]')]
    status = 'verified-export' if mn >= 0.95 and not errs else 'adapter-compatible' if mn >= 0.85 and not errs else 'specialized' if not errs else 'unsupported'
    ev = {'prodSsimMin': round(mn, 3), 'adapterErrors': errs[:3], 'motion': None, 'export': exp.get(k)}
    m = motion(k); ev['motion'] = round(m, 4) if m is not None else None; ev['kind'] = 'static' if m is not None and m < 0.0005 else 'animated'
    if status == 'verified-export' and nb.get(k, 1) < 0.003: status = 'host-dependent'
    reason = {'host-dependent': 'native standalone reference is blank at every sample: this component only shows inside a host scene (e.g. transitions, captions fed by a transcript); not verified standalone', 'verified-export': f'SSIM >= 0.95 at all samples against native HyperFrames; no adapter errors ({ev["kind"]})', 'adapter-compatible': f'worst-sample SSIM {mn:.3f}', 'specialized': f'worst-sample SSIM {mn:.3f}: content differs from native', 'unsupported': 'adapter errors: ' + '; '.join(errs[:1])[:140]}[status]
    v.update(status=status, reason=reason, evidence=ev, enabled=False, enabledBlockedBy=[])
    if status != 'verified-export': continue
    blocked = [f'{f} feature' for f in BAD if it['features'].get(f)]
    if it['dependencies'].get('remoteAssetFiles') or it['features'].get('remoteImages'): blocked.append('remote assets not pinned')
    onb = ours_nonblank(k); ev['nonBlank'] = round(onb, 4)
    if onb < 0.002: blocked.append('standalone output is (nearly) blank')
    e = exp.get(k)
    if not e: blocked.append('no real browser export run')
    elif not e.get('ok'): blocked.append('browser export failed: ' + str(e.get('error'))[:60])
    elif e.get('fps', 0) < 8: blocked.append(f"export throughput {e.get('fps')} fps < 8")
    eds = edit.get(k, {}).get('editables', []); fx = eff.get(k, {})
    good = [x for x in eds if fx.get(x['key'], {}).get('effective')]
    vt = edit.get(k, {}).get('visibleText')
    ready = False
    if not good:
        if vt == [] or vt is None and not eds: ready = (vt == [])
        if ready and onb < 0.01: ready = False
        if not ready: blocked.append('no editable field with a measured visible effect' if eds else 'shows built-in content and exposes no editable field')
    elif vt and not any(x['type'] == 'text' for x in good): blocked.append('shows built-in text that cannot be edited')
    v['enabledBlockedBy'] = blocked; v['enabled'] = not blocked
    if v['enabled']:
        base = {'id': k, 'type': it['type'], 'title': it['title'], 'description': it['description'], 'tags': it['tags'], 'category': (it['tags'][0] if it['tags'] else 'other'),
                'dimensions': it.get('dimensions') or {'width': 1920, 'height': 1080}, 'sourceSha256': it['sourceSha256'], 'readyToUse': ready, 'editables': good, 'motion': ev['kind']}
        files = [f for f in it['files'] if f['sha256']]
        base['files'] = [{'path': f['path'], 'target': f['target'], 'sha256': f['sha256']} for f in files]
        if it['type'] == 'block':
            base.update(duration=it['duration'], dimensions=it['dimensions'])
        elif it['type'] == 'component':
            d = 5.0; mm = __import__('re').search(r'data-composition-duration="([\d.]+)"', open(f'{a.upstream}/registry/components/{k}/{k}.html').read()); d = float(mm.group(1)) if mm else d
            base.update(duration=d, dimensions={'width': 1920, 'height': 1080}, project={'dir': 'components', 'host': True, 'files': {f['path']: f['sha256'] for f in files}})
        else:
            base.update(duration=it.get('duration') or 10, sourceSha256=next((f['sha256'] for f in files if f['path'] == 'index.html'), ''), project={'dir': f'examples/{k}', 'entry': 'index.html', 'files': {f['path']: f['sha256'] for f in files}})
        newitems.append(base)
newids = {i['id'] for i in newitems}
en['items'] = [i for i in en['items'] if i.get('type', 'block') == 'block' and i['id'] not in newids]
en['items'] += newitems
from collections import Counter
for t in ('block', 'component', 'example'):
    cls['byType'][t] = dict(Counter(v['status'] for v in cls['items'].values() if v['type'] == t))
cls['totals'] = dict(Counter(v['status'] for v in cls['items'].values())); cls['enabledCount'] = len(en['items'])
json.dump(cls, open(f'{R}/src/lib/hyperframes/catalog.classification.json', 'w'), indent=1); json.dump(en, open(f'{R}/src/lib/hyperframes/catalog.enabled.json', 'w'), indent=1)
print('components/examples enabled:', len(newitems), Counter(v['status'] for k, v in cls['items'].items() if v['type'] in ('component', 'example')))
