#!/usr/bin/env python3
"""Per-resource ledger: every catalog item id -> status, verified?, enabled?, exact reason/blocker. Fails (exit 1) if the data files disagree.
   python3 scripts/hyperframes/reconcile.py  -> docs/hyperframes-resource-ledger.csv + .md"""
import csv, json, os, sys
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
j = lambda p: json.load(open(os.path.join(R, p)))
cls = j('src/lib/hyperframes/catalog.classification.json'); items = cls['items']
en = {i['id']: i for i in j('src/lib/hyperframes/catalog.enabled.json')['items']}
dis = set(j('src/lib/hyperframes/catalog.disabled.json')['ids'])
man = {i['id']: i for i in j('src/lib/hyperframes/catalog.manifest.json')['items']}
vend = {f[:-5] for f in os.listdir(os.path.join(R, 'public/hyperframes/blocks')) if f.endswith('.html')}
vend |= {f[:-5] for f in os.listdir(os.path.join(R, 'public/hyperframes/components')) if f.endswith('.html')} if os.path.isdir(os.path.join(R, 'public/hyperframes/components')) else set()
vend |= {d for d in os.listdir(os.path.join(R, 'public/hyperframes/blocks')) if os.path.isfile(os.path.join(R, 'public/hyperframes/blocks', d, d + '.html'))}  # blocks that ship their own folder
vend |= set(os.listdir(os.path.join(R, 'public/hyperframes/component-demos'))) if os.path.isdir(os.path.join(R, 'public/hyperframes/component-demos')) else set()  # components shown through their own demo composition
vend |= set(os.listdir(os.path.join(R, 'public/hyperframes/examples'))) if os.path.isdir(os.path.join(R, 'public/hyperframes/examples')) else set()
errs = []
rows = []
for k, v in sorted(items.items()):
    t = v['type']; st = v['status']; enabled = k in en
    if t == 'block':
        if st == 'verified-export': held = not enabled
        else: held = False
    if enabled and not v.get('enabled'): errs.append(f'{k}: in enabled.json but classification says not enabled')
    if v.get('enabled') and not enabled: errs.append(f'{k}: classification enabled but missing from enabled.json')
    if enabled and k not in vend: errs.append(f'{k}: enabled but not vendored')
    want = next((f['sha256'] for f in man[k]['files'] if f['path'] == 'index.html'), '') if t == 'example' else (en[k]['project']['files']['demo.html'] if enabled and en[k].get('project', {}).get('demo') else man[k]['sourceSha256'])
    if enabled and en[k]['sourceSha256'] != want: errs.append(f'{k}: enabled sha differs from manifest')
    reason = '; '.join(v['enabledBlockedBy']) if (st == 'verified-export' and not enabled and v['enabledBlockedBy']) else v['reason']
    if st == 'verified-export' and not enabled and not v['enabledBlockedBy']: reason = 'verified but held back without a recorded blocker'; errs.append(f'{k}: held back with no blocker')
    rows.append({'id': k, 'type': t, 'status': st, 'verified': 'yes' if st == 'verified-export' else 'no', 'enabled': 'yes' if enabled else 'no',
                 'catalogDisabled': 'yes' if k in dis else 'no', 'prodSsimMin': (v.get('evidence') or {}).get('prodSsimMin', ''), 'editableFields': len(en[k]['editables']) if enabled else '', 'reason': reason})
extra = vend - set(en)
if extra: errs.append('vendored but not enabled: ' + ', '.join(sorted(extra)))
blocks = [r for r in rows if r['type'] == 'block']; ver = [r for r in blocks if r['verified'] == 'yes']; ena = [r for r in blocks if r['enabled'] == 'yes']
held = [r for r in ver if r['enabled'] == 'no']
if len(ver) != len(ena) + len(held): errs.append('verified != enabled + held-back')
out = os.path.join(R, 'docs'); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'hyperframes-resource-ledger.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
md = [f'# HyperFrames resource ledger\n\nBlocks: {len(blocks)} total, **{len(ver)} verified = {len(ena)} enabled + {len(held)} held back**. Items of other types: {len(rows) - len(blocks)}.\n', '## Enabled blocks\n', ', '.join(r['id'] for r in ena), '\n## Verified but held back (exact blocker)\n', '| Block | Blocker |', '|---|---|']
md += [f"| {r['id']} | {r['reason']} |" for r in held]
open(os.path.join(out, 'hyperframes-resource-ledger.md'), 'w').write('\n'.join(md) + '\n')
print(f'blocks {len(blocks)}: verified {len(ver)} = enabled {len(ena)} + held-back {len(held)}')
if errs: print('\n'.join('MISMATCH ' + e for e in errs)); sys.exit(1)
print('ledger consistent')
