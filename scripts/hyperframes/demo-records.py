#!/usr/bin/env python3
"""Builds catalog.enabled.json records that show a COMPONENT through the demo composition shipped with it (registry/components/<id>/demo.html), pinned by sha256.
That demo is the 'larger scene' a host-dependent primitive needs (transitions, text effects, cursors...), and it is also what native HyperFrames renders for the same component.
   python3 scripts/hyperframes/demo-records.py --upstream <checkout> --base <enabled.json> --out <enabled.json> [--ids a,b,c | --all-not-enabled]"""
import argparse, hashlib, json, os, re
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser(); ap.add_argument('--upstream', required=True); ap.add_argument('--base', required=True); ap.add_argument('--out', required=True); ap.add_argument('--ids', default=''); ap.add_argument('--all-not-enabled', action='store_true'); a = ap.parse_args()
man = {i['id']: i for i in json.load(open(f'{R}/src/lib/hyperframes/catalog.manifest.json'))['items'] if i['type'] == 'component'}
en = json.load(open(a.base)); have = {i['id'] for i in en['items']}
ids = [x for x in a.ids.split(',') if x] if a.ids else [k for k in man if k not in have]
n = 0
for k in ids:
    if k in have or k not in man: continue
    p = f'{a.upstream}/registry/components/{k}/demo.html'
    if not os.path.exists(p): continue
    raw = open(p, 'rb').read(); sha = hashlib.sha256(raw).hexdigest(); html = raw.decode('utf8')
    num = lambda attr: (lambda m: float(m.group(1)) if m else None)(re.search(attr + r'="([\d.]+)"', html))
    w, h, d = num('data-width') or 1920, num('data-height') or 1080, num('data-duration') or 5.0
    it = man[k]; extra = {}
    m = re.search(r'<[a-zA-Z]+\b[^>]*data-composition-src="[^"]+"[^>]*>', html)  # the element that mounts the component: its id (or composition id) addresses instance variables
    inst = None
    if m:
        mi = re.search(r'\bid="([^"]+)"', m.group(0)) or re.search(r'data-composition-id="([^"]+)"', m.group(0)); inst = mi.group(1) if mi else None
    for src in sorted(set(re.findall(r'data-composition-src="([^"]+)"', html))):  # nested files the demo mounts (normally the component snippet itself)
        rel = os.path.normpath(src); fp = f'{a.upstream}/registry/components/{k}/{rel}'
        if os.path.isfile(fp) and not rel.startswith('..'): extra[rel] = hashlib.sha256(open(fp, 'rb').read()).hexdigest()
    en['items'].append({'id': k, 'type': 'component', 'title': it['title'], 'description': it['description'], 'tags': it['tags'], 'category': (it['tags'] or ['other'])[0], 'dimensions': {'width': int(w), 'height': int(h)}, 'duration': d,
        'sourceSha256': sha, 'readyToUse': False, 'files': [{'path': 'demo.html', 'target': f'component-demos/{k}/demo.html', 'sha256': sha}] + [{'path': r, 'target': f'component-demos/{k}/{r}', 'sha256': h} for r, h in extra.items()], 'editables': [],
        'project': {'dir': f'component-demos/{k}', 'entry': 'demo.html', 'demo': True, **({'instance': inst} if inst else {}), 'files': {'demo.html': sha, **extra}}})
    n += 1
json.dump(en, open(a.out, 'w'), indent=1); print('demo records added:', n, '-> total', len(en['items']))
