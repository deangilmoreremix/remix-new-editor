#!/usr/bin/env python3
"""Classifies every HyperFrames catalog item from MEASURED evidence and decides which may be enabled for customers.

  python3 scripts/hyperframes/classify.py --manifest src/lib/hyperframes/catalog.manifest.json \
      --stills <blocks.json> --compare <compare.json> --exports <results-sweep.json> --editables <editables.json> \
      --out-classification src/lib/hyperframes/catalog.classification.json --out-enabled src/lib/hyperframes/catalog.enabled.json

Statuses (exactly one per item):
  verified-export     renders at 3 sample times with no error, SSIM vs native HyperFrames >= 0.95 at every sample, and an MP4 export succeeds
  adapter-compatible  renders and exports, SSIM 0.85-0.95 at the worst sample (works through generic adapter transforms, with visible differences)
  specialized         renders but SSIM < 0.85 at the worst sample, i.e. content differs; needs component-specific work
  unsupported         does not render or export in the browser renderer (error, timeout, missing API)
  not-tested          no usable evidence: components/starter projects (except those measured), or blocks with no native reference to compare against

ENABLED FOR CUSTOMERS (separate from status): status == verified-export AND policy passes:
  no WebGL / three.js / WebGPU / HTML-in-canvas (expensive or unsupported until optimised and retested), no audio/video elements,
  no sub-compositions, no unseeded Math.random, no infinite GSAP repeat, no remote images, every external script vendored,
  export throughput >= MIN_FPS frames per second, and at least one editable field.
"""
import argparse, json, os, sys

MIN_FPS = 8.0
SSIM_VERIFIED, SSIM_ADAPTER = 0.95, 0.85

ap = argparse.ArgumentParser()
for k in ('manifest', 'stills', 'compare', 'exports', 'editables', 'out-classification', 'out-enabled'): ap.add_argument('--' + k, required=True)
ap.add_argument('--prod-results', default=None, help='per-block {logs, fatal} from the production renders; any adapter error blocks enablement')
ap.add_argument('--effect', default=None, help='measure-effect.py output: editables without a measured visible effect are dropped')
ap.add_argument('--prod-compare', default=None, help='SSIM of the PRODUCTION adapter path (sandboxed preview frame) vs native; when given, a block must also reach SSIM_VERIFIED there')
a = ap.parse_args()
man = json.load(open(a.manifest)); stills = json.load(open(a.stills)); cmp_ = json.load(open(a.compare))
exp = {r['label'].replace('sweep-', ''): r for r in json.load(open(a.exports))}
edit = json.load(open(a.editables)) if os.path.exists(a.editables) else {}
prod = json.load(open(a.prod_compare)) if a.prod_compare else None
effect = json.load(open(a.effect)) if a.effect else None
prodres = json.load(open(a.prod_results)) if a.prod_results else {}
cdn_map = json.load(open(os.path.join(os.path.dirname(a.stills), '..', 'public', 'blocks', '_cdn', 'map.json'))) if os.path.exists(os.path.join(os.path.dirname(a.stills), '..', 'public', 'blocks', '_cdn', 'map.json')) else None

def policy_block(it):
    f, d = it['features'], it['dependencies']; why = []
    for k, label in (('webgl', 'WebGL'), ('three', 'three.js'), ('webgpu', 'WebGPU'), ('htmlInCanvas', 'HTML-in-canvas API'), ('video', 'video element'), ('audio', 'audio element'), ('subcomposition', 'sub-composition'), ('unseededRandom', 'unseeded Math.random'), ('infiniteRepeat', 'infinite GSAP repeat')):
        if f.get(k): why.append(label)
    if f.get('remoteImages'): why.append('remote image URL')
    if d.get('remoteAssetFiles'): why.append('asset files hosted remotely (not pinned/vendored)')
    if cdn_map is not None and any(s.startswith('http') and s not in cdn_map for s in d['scripts']): why.append('external script not vendored')
    return why

items, enabled = {}, []
for it in man['items']:
    n = it['id']; rec = {'type': it['type'], 'status': 'not-tested', 'reason': 'no browser-renderer evidence collected for this item', 'evidence': None, 'enabled': False, 'enabledBlockedBy': []}
    if it['type'] == 'block' and n in stills:
        r = stills[n]; frames = r.get('frames', [])
        errs = [f for f in frames if 'error' in f] + ([{'error': r['fatal']}] if r.get('fatal') else [])
        ss = list((cmp_.get(n) or {}).values()); e = exp.get(n)
        ev = {'stillsOk': f"{sum(1 for f in frames if 'png' in f or 'v' in f)}/{len(frames)}", 'ssim': [round(x, 3) for x in ss if x is not None], 'ssimMin': round(min(ss), 3) if ss else None,
              'export': ({'ok': e['ok'], 'frames': e['video']['frames'], 'fps': round(e['video']['frames'] / (e['ms'] / 1000), 1), 'bytes': e['bytes']} if e and e.get('ok') else ({'ok': False, 'error': (e or {}).get('error', 'not run')} if e else None))}
        rec['evidence'] = ev
        aerr = r.get('errors') or []  # problems reported by the adapter itself (script failures, no seekable timeline, blocked URLs)
        if aerr and not errs and frames:
            kind = aerr[0].split(' ')[0]
            why = {'timeline': 'no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline)', 'blocked-url': 'needs a resource from a host that is not allow-listed', 'script': 'a block script failed to run', 'mount': 'the block failed to mount'}.get(kind, 'adapter error')
            rec.update(status='unsupported', reason=f"{why}: {aerr[0][:110]}")
        elif errs or not frames:
            rec.update(status='unsupported', reason=str((errs[0] if errs else {'error': 'no frames'}).get('error'))[:160])
        elif not ss:
            rec.update(status='not-tested', reason='renders, but the native HyperFrames reference could not be produced here, so fidelity is unverified')
        elif e is None:  # no export attempted (the sweep only exported blocks that rendered well): do not call that an export failure
            m = min(ss)
            if m < SSIM_ADAPTER: rec.update(status='specialized', reason=f'renders, but worst-sample SSIM {m:.3f}: content differs from native (export not attempted)')
            else: rec.update(status='not-tested', reason=f'worst-sample SSIM {m:.3f}; MP4 export not attempted')
        elif not e.get('ok'):
            rec.update(status='unsupported', reason='MP4 export failed: ' + str(e.get('error', 'unknown'))[:120])
        else:
            m = min(ss)
            if m >= SSIM_VERIFIED: rec.update(status='verified-export', reason=f'SSIM >= {SSIM_VERIFIED} at all samples; MP4 export OK')
            elif m >= SSIM_ADAPTER: rec.update(status='adapter-compatible', reason=f'worst-sample SSIM {m:.3f}; exports, with visible differences')
            else: rec.update(status='specialized', reason=f'worst-sample SSIM {m:.3f}: content differs from native')
        if prod is not None and rec['status'] == 'verified-export' and n in prod:
            pv = [x for x in (prod.get(n) or {}).values() if x is not None]
            ev['prodSsimMin'] = round(min(pv), 3) if pv else None
            if pv and min(pv) < SSIM_VERIFIED: rec.update(status='adapter-compatible' if min(pv) >= SSIM_ADAPTER else 'specialized', reason=f'production adapter path worst-sample SSIM {min(pv):.3f} (research harness reached {min(ss):.3f})')
        if rec['status'] == 'verified-export':
            blocked = policy_block(it)
            if ev['export'] and ev['export']['fps'] < MIN_FPS: blocked.append(f"export throughput {ev['export']['fps']} fps < {MIN_FPS}")
            ed = edit.get(n, {}).get('editables', [])
            if effect is not None and n in effect:  # keep only fields whose edit visibly changes the render
                dropped = [e['key'] for e in ed if not effect[n].get(e['key'], {}).get('effective', False) and e['target']['kind'] != 'attr']
                had = len(ed); ed = [e for e in ed if e['key'] not in dropped]; rec['droppedIneffective'] = dropped
                if had and not ed: blocked.append('no editable field with a measured visible effect')
            vt = edit.get(n, {}).get('visibleText')  # text nodes present in the rendered block (None = not analysed)
            has_text_ed = any(e['type'] == 'text' and e['target']['kind'] in ('text', 'cfg', 'var') for e in ed)
            if not ed:
                if vt is not None and len(vt) == 0: rec['readyToUse'] = True  # pure effect/background: nothing customer-specific to edit
                else: blocked.append('no editable fields detected')
            elif vt and not has_text_ed:
                blocked.append('shows built-in text that cannot be edited')
            if prodres.get(n, {}).get('logs') or prodres.get(n, {}).get('fatal'): blocked.append('adapter reported errors in the production render')
            if prod is not None and ev.get('prodSsimMin') is None: blocked.append('not yet rendered through the production adapter path')
            rec['enabledBlockedBy'] = blocked; rec['enabled'] = not blocked
            if rec['enabled']:
                enabled.append({'id': n, 'type': 'block', 'title': it['title'], 'description': it['description'], 'tags': it['tags'], 'category': (it['tags'][0] if it['tags'] else 'other'),
                                'dimensions': it['dimensions'], 'duration': it['duration'], 'sourceSha256': it['sourceSha256'], 'readyToUse': bool(rec.get('readyToUse')),
                                'files': [{'path': f['path'], 'target': f['target'], 'sha256': f['sha256']} for f in it['files']], 'editables': ed})
    elif it['type'] == 'component':
        rec['reason'] = 'components are HTML fragments that need a host composition; only the four caption styles were measured in the proof of concept'
    elif it['type'] == 'example':
        rec['reason'] = 'starter projects (multi-composition) are not supported by the timeline overlay model yet'
    items[n] = rec

from collections import Counter
cnt = Counter(v['status'] for v in items.values())
by_type = {t: dict(Counter(v['status'] for v in items.values() if v['type'] == t)) for t in ('block', 'component', 'example')}
blocked = Counter(w for v in items.values() if v['status'] == 'verified-export' and not v['enabled'] for w in v['enabledBlockedBy'])
out = {'schemaVersion': 1, 'upstreamCommit': man['upstream']['commit'], 'thresholds': {'ssimVerified': SSIM_VERIFIED, 'ssimAdapter': SSIM_ADAPTER, 'minExportFps': MIN_FPS},
       'totals': dict(cnt), 'byType': by_type, 'verifiedButNotEnabled': dict(blocked), 'enabledCount': len(enabled), 'items': items}
json.dump(out, open(a.out_classification, 'w'), indent=1); json.dump({'upstreamCommit': man['upstream']['commit'], 'items': enabled}, open(a.out_enabled, 'w'), indent=1)
print('totals', dict(cnt)); print('by type', by_type); print('verified but blocked by policy:', dict(blocked)); print('ENABLED for customers:', len(enabled))
