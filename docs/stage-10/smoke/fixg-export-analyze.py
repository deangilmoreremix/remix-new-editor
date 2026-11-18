#!/usr/bin/python3
"""Fix G: check REAL exported frames (Export tab, Remotion web renderer, h264) of a clip carrying Pixel Sort against a CONTROL export of the same clip with the
effect disabled (same codec / colour path; comparing with an ffmpeg decode of the source is unreliable because the web renderer's colour range / frame
alignment differ).
usage: fixg-export-analyze.py <dir>  (dir holds fixg-export.mp4 and fixg-export-control.mp4)
Smoke setup: Pixel Sort window 0.05..0.95, luma ascending, horizontal, Length keyed to N (24 default) at 1 s and to 0 at 2 s.
t = 1 s: the row luma multiset is preserved (row-sorted luma diff small, far smaller than for rows shifted by 40) while many pixels moved.
t = 2 s (Length 0): the frame equals the control. Prints JSON."""
import json, subprocess, sys, os
import numpy as np
d = sys.argv[1]
export = os.path.join(d, 'fixg-export.mp4'); control = os.path.join(d, 'fixg-export-control.mp4')
o = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', export]))['streams'][0]
W, H = o['width'], o['height']
def frame(f, t):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '%.4f' % t, '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float64)
def luma(a): return a @ np.array([0.2126, 0.7152, 0.0722])
def rowsort_diff(la, lb, shift=0): return float(np.abs(np.sort(la[: H - shift], 1) - np.sort(lb[shift:], 1)).mean())
checks = []; nums = {'export_size': [W, H]}
def chk(ok, msg): checks.append({'ok': bool(ok), 'msg': msg})
for t in (1.0, 2.0):
    e, c = frame(export, t), frame(control, t); le, lc = luma(e), luma(c)
    r = {'mean_abs_diff_vs_control': float(np.abs(e - c).mean()), 'fraction_pixels_moved_gt30': float(np.mean(np.abs(le - lc) > 30)),
         'rowsorted_luma_diff': rowsort_diff(le, lc), 'rowsorted_control_rows_shifted_by_40': rowsort_diff(le, lc, 40)}
    nums['t%.1f' % t] = r
    if t == 1.0:
        chk(r['fraction_pixels_moved_gt30'] > 0.02, 'frame at 1.0 s: %.1f %% of the pixels differ from the un-sorted control by more than 30 luma levels' % (100 * r['fraction_pixels_moved_gt30']))
        chk(r['rowsorted_luma_diff'] < 3.0 and r['rowsorted_luma_diff'] < 0.4 * r['rowsorted_control_rows_shifted_by_40'], 'frame at 1.0 s: every row keeps its luma multiset (row-sorted diff %.2f levels vs %.2f for rows shifted by 40), i.e. pixels were only permuted along rows' % (r['rowsorted_luma_diff'], r['rowsorted_control_rows_shifted_by_40']))
    else:
        chk(r['fraction_pixels_moved_gt30'] < 0.02 and r['mean_abs_diff_vs_control'] < 3.0, 'frame at 2.0 s (Length keyed to 0) equals the control (%.2f %% moved, mean abs diff %.2f)' % (100 * r['fraction_pixels_moved_gt30'], r['mean_abs_diff_vs_control']))
print(json.dumps({'checks': checks, 'numbers': nums}, indent=1))
