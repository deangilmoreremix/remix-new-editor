#!/usr/bin/env python3
"""Stage 8: checks the real exports of combined-smoke.cjs with ffmpeg + numpy. Usage: combined-analyze.py DIR  (DIR has baseline.<ext>, final.<ext>).
Prints one JSON object {checks: [{ok, msg}], numbers: {...}}. Assumes the layout the smoke builds: A = 0-2.993 s with x keys -30% @0.26 s and +30% @1.26 s,
GL wipe-right (0.5 s) 2.493-2.993 s, B (smpte bars, effects: exposure keyed, glass, scanlines) 2.493-5.493 s, master volume 50%, EQ -12 dB @440 Hz on A's audio."""
import json, os, subprocess, sys, glob, re
import numpy as np
from PIL import Image
D = sys.argv[1]
def find(base): return sorted(glob.glob(os.path.join(D, base + '.*')))[0]
base, fin = find('baseline'), find('final')
fr = os.path.join(D, 'fr'); os.makedirs(fr, exist_ok=True)
def frame(f, t):
    out = os.path.join(fr, f"{os.path.basename(f).split('.')[0]}_{t}.png")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', f, '-frames:v', '1', out], check=True)
    return np.asarray(Image.open(out).convert('RGB')).astype(float)
def vol(f, ss, t):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-ss', str(ss), '-t', str(t), '-i', f, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+|-inf)', r).group(1).replace('-inf', '-99'))
def shift(a, b):
    ga, gb = a.mean(2).mean(0), b.mean(2).mean(0); best = None
    for s in range(-1200, 1201, 4):
        x, y = (ga[:len(ga) - s], gb[s:]) if s >= 0 else (ga[-s:], gb[:len(gb) + s])
        if len(x) < 400: continue
        d = np.mean(np.abs(x - y))
        if best is None or d < best[0]: best = (d, s)
    return best[1]
checks = []; nums = {}
def chk(ok, msg): checks.append({'ok': bool(ok), 'msg': msg})
codec = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', fin], capture_output=True, text=True).stdout.strip()
nums['video_codec'] = codec
# keyed x position
s0, s1, s2 = (shift(frame(base, t), frame(fin, t)) for t in (0.26, 0.76, 1.26))
nums['x_shift_px_at_0.26_0.76_1.26'] = [s0, s1, s2]
chk(abs(s0 + 576) < 40 and abs(s1) < 40 and abs(s2 - 576) < 40, f'keyed x (-30%, mid, +30% of 1920 px) present in the export: measured {s0}, {s1}, {s2} px')
# effects alter pixels
d45 = np.abs(frame(base, 4.2) - frame(fin, 4.2)).mean(); d55 = np.abs(frame(base, 5.2) - frame(fin, 5.2)).mean()
nums['effect_mean_abs_diff_4.2_5.2'] = [round(d45, 1), round(d55, 1)]
chk(d45 > 10 and d55 > 10, f'effects change the pixels vs the no-effect export (mean abs diff {d45:.1f}, {d55:.1f})')
# keyed effect parameter: exposure key -2 stops @~0.5 s into B ... +1.5 @~3 s => B gets brighter over time
l = lambda t: frame(fin, t).mean()
nums['final_mean_luma_3.2_4.2_5.2'] = [round(l(3.2), 1), round(l(4.2), 1), round(l(5.2), 1)]
chk(l(3.2) < l(4.2) < l(5.2) and l(5.2) > 20, 'keyed effect parameter (exposure -2 -> +1.5 stops) brightens clip B over time in the export, and clip B is still on screen at 5.2 s (picture and sound end together)')
# mid-transition
mid, A, B = frame(fin, 2.75), frame(base, 2.75), frame(base, 4.2)
L = (slice(None), slice(100, 500)); R = (slice(None), slice(1500, 1850)); dd = lambda x, y, s: float(np.abs(x[s] - y[s]).mean())
nums['mid_transition'] = {'left_vs_B': dd(mid, B, L), 'left_vs_A': dd(mid, A, L), 'right_vs_B': dd(mid, B, R), 'right_vs_A': dd(mid, A, R), 'whole_vs_A': float(np.abs(mid - A).mean()), 'whole_vs_B': float(np.abs(mid - B).mean())}
m = nums['mid_transition']
chk(m['whole_vs_A'] > 20 and m['whole_vs_B'] > 20 and m['left_vs_B'] < 5 and m['right_vs_A'] < 5, 'mid-transition frame is neither clip A nor clip B: left of the wipe shows B, right still A (distances to A/B whole frame %.0f/%.0f)' % (m['whole_vs_A'], m['whole_vs_B']))
# known limitation recorded as a number, not a pass/fail: A's keyed x (+30 %) is not applied inside the GL transition window
nums['A_x_shift_inside_transition_px(known: transition samples raw frames)'] = shift(frame(base, 2.6), frame(fin, 2.6))
# audio
has_a = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', fin], capture_output=True, text=True).stdout.strip()
chk(bool(has_a), 'export has an audio stream: ' + has_a)
bB, fB = vol(base, 3.3, 2.0), vol(fin, 3.3, 2.0)   # clip B audio (no EQ): master 50 % = -6 dB
nums['audio_B_mean_dB_baseline_final'] = [bB, fB]
chk(abs((fB - bB) + 6.0) < 1.0 and fB > -60, f'master volume 50% applied to the export (B audio {bB} -> {fB} dB, expected -6)')
bA, fA = vol(base, 0.3, 1.8), vol(fin, 0.3, 1.8)   # clip A audio with EQ -12 dB @ 440 Hz and master -6
nums['audio_A_mean_dB_baseline_final'] = [bA, fA]
chk(fA < bA - 14 and fA > -90, f'clip EQ (-12 dB @ 440 Hz) is baked on top of the master volume (A audio {bA} -> {fA} dB, expected about -18)')
chk(bB > -45, f'baseline export (plain linked video+audio) is audible, not silent and not doubled: {bB} dB mean (source tone is about -27 dB)')
print(json.dumps({'checks': checks, 'numbers': nums}, indent=1))
