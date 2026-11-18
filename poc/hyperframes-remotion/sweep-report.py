"""Builds the sweep table: SSIM vs native, motion, alpha, errors. Usage: SWEEP=sweep30.json python3 sweep-report.py"""
import json, os, subprocess, re
S = json.load(open(os.environ['SWEEP'])); B = json.load(open('out/blocks.json')); C = json.load(open('out/compare.json'))
rows = []
for n, m in S.items():
    r = B.get(n, {}); fr = r.get('frames', [])
    ok = [f for f in fr if 'v' in f]
    motion = None
    if len(ok) >= 2:
        d = [sum(abs(a - b) for a, b in zip(ok[i]['v'], ok[i + 1]['v'])) / len(ok[i]['v']) for i in range(len(ok) - 1)]
        motion = round(max(d), 1)
    alpha = []
    for f in ok:
        p = f"out/blocks/{n}/t{f['t']}.png"
        if os.path.exists(p):
            o = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-vf', 'alphaextract,scale=1:1:flags=area,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
            alpha.append(o[0] if o else None)
    ss = C.get(n, {})
    rows.append({'name': n, 'category': m['category'], 'type': m['type'], 'dims': f"{m['dims']['width']}x{m['dims']['height']}",
                 'ssim': [round(v, 3) for v in ss.values() if v is not None], 'ssim_min': round(min(ss.values()), 3) if ss else None,
                 'motion': motion, 'alpha_min': min(alpha) if alpha else None, 'stills_ok': f"{len(ok)}/{len(fr)}",
                 'errors': (r.get('errors') or []) + ([r['fatal']] if r.get('fatal') else []) + [f['error'] for f in fr if 'error' in f]})
json.dump(rows, open('out/sweep-table.json', 'w'), indent=1)
for x in rows: print(f"{x['name']:26} {x['category'][:14]:14} ssim={x['ssim']} motion={x['motion']} alpha={x['alpha_min']} stills={x['stills_ok']} {('ERR ' + x['errors'][0][:70]) if x['errors'] else ''}")
