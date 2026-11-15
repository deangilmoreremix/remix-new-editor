"""Side-by-side native|mine at the SAME timestamp. Usage: REF=<ref dir> SWEEP=sweep.json python3 pair.py name[,name...] [timeIndex=1]"""
import json, os, re, subprocess, sys, glob
S = json.load(open(os.environ['SWEEP'])); REF = os.environ['REF']; idx = int(sys.argv[2]) if len(sys.argv) > 2 else 1
os.makedirs('out/pairs', exist_ok=True)
for n in sys.argv[1].split(','):
    t = S[n]['times'][idx]; ts = ('%g' % t)
    nat = [f for f in glob.glob(f'{REF}/{n}/snap/frame-*-at-*s.png') if re.search(rf'at-{re.escape(ts)}s\.png$', f)]
    mine = f'out/blocks/{n}/t{ts}.png'
    if not nat or not os.path.exists(mine): print(n, 'missing', ts, bool(nat), os.path.exists(mine)); continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mine, '-i', nat[0], '-filter_complex', '[1:v][0:v]scale2ref[r][m];[r][m]hstack,scale=1000:-1', f'out/pairs/{n}.png'])
    print(n, 't=', ts, '->', f'out/pairs/{n}.png')
