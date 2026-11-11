#!/usr/bin/env python3
"""For each (block, editable) override render, measures how much of the frame changed vs the default render at the same time.
   python3 scripts/hyperframes/measure-effect.py --spec spec.json --default-dir out/prod --override-dir out/eff --out effect.json
An editable only counts as EFFECTIVE if the change is >= 0.0003 of the frame (about 40 px at 480x270) at one of the sample times."""
import argparse, json, os
from PIL import Image, ImageChops
ap = argparse.ArgumentParser(); [ap.add_argument('--' + k, required=True) for k in ('spec', 'default-dir', 'override-dir', 'out')]; a = ap.parse_args()
fmt = lambda t: '%g' % t
out = {}
for s in json.load(open(a.spec)):
    block, _, key = s['id'].partition('--'); fr = []
    for t in s['times']:
        try:
            d = Image.open(f"{a.default_dir}/{block}/t{fmt(t)}.png").convert('L').resize((480, 270)); o = Image.open(f"{a.override_dir}/{s['id']}/t{fmt(t)}.png").convert('L').resize((480, 270))
            fr.append(round(sum(1 for p in ImageChops.difference(d, o).tobytes() if p > 12) / (480 * 270), 4))
        except Exception: fr.append(None)
    out.setdefault(block, {})[key] = {'override': s['overrides'], 'changedFraction': fr, 'effective': any(x is not None and x >= 0.0003 for x in fr)}
json.dump(out, open(a.out, 'w'), indent=1)
tot = sum(len(v) for v in out.values()); eff = sum(1 for v in out.values() for x in v.values() if x['effective'])
print(f'{eff}/{tot} editable fields have a visible effect across {len(out)} blocks')
