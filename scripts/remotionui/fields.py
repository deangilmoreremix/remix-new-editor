"""Keeps only the inspector fields that visibly change the picture, and drops items that would show text a customer cannot change.
   python3 scripts/remotionui/fields.py --effect effect.json --defaults out/ruif-default/results.json
Writes src/lib/remotionui/fields.json ({name: [effective field keys]}) and marks items with no effective field AND visible text as not enabled in verification.json."""
import argparse, json
ap = argparse.ArgumentParser(); ap.add_argument('--effect', required=True); ap.add_argument('--defaults', required=True); a = ap.parse_args()
eff = json.load(open(a.effect)); res = {r['id']: r for r in json.load(open(a.defaults))}
cat = {i['name']: i for i in json.load(open('src/lib/remotionui/catalog.json'))['items'] if i['enabled']}
ver = json.load(open('src/lib/remotionui/verification.json')); fields = {}; dropped = {}
for name, it in cat.items():
    keys = [e['key'] for e in it['editables'] if eff.get(name, {}).get(e['key'], {}).get('effective')]
    tested = set(eff.get(name, {})); untested = [e['key'] for e in it['editables'] if e['key'] not in tested]  # fields beyond the first five stay as they are only if the first five were effective
    fields[name] = keys
    text = (res.get(name, {}).get('bodyText') or '').strip()
    if not keys and text: ver[name] = {**ver[name], 'enabled': False, 'reason': 'shows text that a customer cannot change (no field visibly changes it)'}; dropped[name] = text[:40]
json.dump(fields, open('src/lib/remotionui/fields.json', 'w'), indent=1); json.dump(ver, open('src/lib/remotionui/verification.json', 'w'), indent=1)
print('items with >=1 effective field:', sum(1 for k in fields.values() if k), 'of', len(fields), '| no effective field but no text (kept):', sum(1 for n, k in fields.items() if not k and n not in dropped), '| dropped:', len(dropped)); print(dropped)
