#!/usr/bin/python3
"""Fix C: check REAL exported frames (Export tab, Remotion web renderer, h264) of a clip carrying Path Mask (animated anchors) + Corner Pin + Curves
against what the saved project says they should look like.
usage: fixc-export-analyze.py <dir>   (dir holds fixc-saved.json written by fixc-ui-smoke.cjs, fixc-export.mp4 and clipA.mp4)
Expected frames are computed from the SAVED project values only (props + anim keys), with numpy: inverse homography of the corner pin, the mask
rectangle with its animated anchors, and the red channel killed by the curve. Measured = pixels of the exported file. Prints JSON."""
import json, subprocess, sys, os
import numpy as np

d = sys.argv[1]
saved = json.load(open(os.path.join(d, 'fixc-saved.json')))
export = os.path.join(d, 'fixc-export.mp4'); src_file = os.path.join(d, 'clipA.mp4')

def probe(f):
    o = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', f])
    s = json.loads(o)['streams'][0]; return s['width'], s['height'], s['codec_name']

def frame(f, t, size):
    w, h = size
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float64)

clip = saved['clip']
fx = json.loads(clip['fx_json'])
st1 = json.loads(clip['stage1_json']) if clip.get('stage1_json') else {}
anim = (st1.get('anim') or {}).get('keys') or {}
byid = {f['id']: (i, f) for i, f in enumerate(fx)}
mi, mask = byid['builtin:fx-path-mask']; pi, pin = byid['builtin:fx-corner-pin']; ci, curves = byid['builtin:fx-curves']

def sample_keys(keys, t, dflt):
    if not keys: return dflt
    ks = sorted(keys, key=lambda k: k['t'])
    if t <= ks[0]['t']: return ks[0]['v']
    if t >= ks[-1]['t']: return ks[-1]['v']
    for a, b in zip(ks, ks[1:]):
        if a['t'] <= t <= b['t']:
            ease = a.get('ease')
            if ease not in (None, 'linear'): raise SystemExit('analyzer only supports linear keys, got %r' % (ease,))
            return a['v'] + (t - a['t']) / (b['t'] - a['t']) * (b['v'] - a['v'])
    return ks[-1]['v']

flat = mask['props']['path']
verts = [[flat[i], flat[i + 1]] for i in range(0, len(flat), 6)]
assert len(verts) == 4 and all(flat[i + 2:i + 6] == [0, 0, 0, 0] for i in range(0, len(flat), 6)), 'expects the 4-point rectangle (no handles)'
def verts_at(t):
    return [[sample_keys(anim.get('fx:%d:v%dx' % (mi, i)), t, v[0]), sample_keys(anim.get('fx:%d:v%dy' % (mi, i)), t, v[1])] for i, v in enumerate(verts)]
keyed = [k for k in anim if k.startswith('fx:%d:v' % mi)]

def quad():
    p = pin['props']; dflt = [[0, 0], [1, 0], [1, 1], [0, 1]]
    names = [('tlx', 'tly'), ('trx', 'try'), ('brx', 'bry'), ('blx', 'bly')]
    return [[p.get(a, dflt[i][0]), p.get(b, dflt[i][1])] for i, (a, b) in enumerate(names)]

def square_to_quad(q):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
    dx1, dx2, dx3 = x1 - x2, x3 - x2, x0 - x1 + x2 - x3
    dy1, dy2, dy3 = y1 - y2, y3 - y2, y0 - y1 + y2 - y3
    if abs(dx3) < 1e-12 and abs(dy3) < 1e-12: g = h = 0.0
    else:
        den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den
    return np.array([[x1 - x0 + g * x1, x3 - x0 + h * x3, x0], [y1 - y0 + g * y1, y3 - y0 + h * y3, y0], [g, h, 1.0]])

W, H, codec = probe(export); SW, SH, _ = probe(src_file)
Hinv = np.linalg.inv(square_to_quad(quad()))
ys, xs = np.mgrid[0:H, 0:W]; u = (xs + 0.5) / W; v = (ys + 0.5) / H
den = Hinv[2, 0] * u + Hinv[2, 1] * v + Hinv[2, 2]
sx = (Hinv[0, 0] * u + Hinv[0, 1] * v + Hinv[0, 2]) / den; sy = (Hinv[1, 0] * u + Hinv[1, 1] * v + Hinv[1, 2]) / den
in_unit = (sx >= 0) & (sx <= 1) & (sy >= 0) & (sy <= 1)

def in_rect(poly, px, py, margin):
    xs_ = [p[0] for p in poly]; ys_ = [p[1] for p in poly]
    return (px >= min(xs_) + margin) & (px <= max(xs_) - margin) & (py >= min(ys_) + margin) & (py <= max(ys_) - margin)

def erode(mask_, r):
    out = mask_.copy()
    for dy in range(-r, r + 1, max(1, r)):
        for dx in range(-r, r + 1, max(1, r)): out &= np.roll(np.roll(mask_, dy, 0), dx, 1)
    return out
def dilate(mask_, r):
    out = mask_.copy()
    for dy in range(-r, r + 1, max(1, r)):
        for dx in range(-r, r + 1, max(1, r)): out |= np.roll(np.roll(mask_, dy, 0), dx, 1)
    return out

checks = []; numbers = {'export_size': [W, H], 'codec': codec, 'mask_keys': keyed, 'quad': quad()}
def check(ok, msg): checks.append({'ok': bool(ok), 'msg': msg}); print('PASS' if ok else 'FAIL', msg)
check(codec == 'h264', 'exported file is h264 (%s) %dx%d' % (codec, W, H))
check(len(keyed) >= 6, 'the saved project holds animated mask anchors in Clip.anim (%d keyed properties)' % len(keyed))
extents = []
for t in (1.0, 4.4):
    exp = frame(export, t, (W, H)); srcf = frame(src_file, t, (SW, SH))
    poly = verts_at(t)
    inside = in_unit & in_rect(poly, sx, sy, 0.0)
    near = dilate(inside, 4)
    core = erode(in_unit & in_rect(poly, sx, sy, 0.02), 6)
    g_plus_b = exp[..., 1] + exp[..., 2]
    visible = g_plus_b > 30
    sxp = np.clip((sx * SW).astype(int), 0, SW - 1); syp = np.clip((sy * SH).astype(int), 0, SH - 1)
    mapped = srcf[syp, sxp]
    confident = core & ((mapped[..., 1] + mapped[..., 2]) > 80)
    frac_vis = float(visible[confident].mean()) if confident.any() else 0.0
    outside = ~near
    frac_black = float((g_plus_b[outside] < 40).mean())
    red_inside = float(exp[..., 0][core].mean()); gdiff = float(np.median(np.abs(exp[..., 1][core] - mapped[..., 1][core])))
    xs_vis = np.where(visible.any(axis=0))[0]; extent = (float(xs_vis.min() / W), float(xs_vis.max() / W)) if len(xs_vis) else (0, 0)
    exp_xs = np.where(inside.any(axis=0))[0]; exp_extent = (float(exp_xs.min() / W), float(exp_xs.max() / W)) if len(exp_xs) else (0, 0)
    extents.append((t, extent, exp_extent))
    numbers['t=%.1f' % t] = {'expected_x_extent': exp_extent, 'measured_x_extent': extent, 'confident_pixels': int(confident.sum()), 'visible_fraction_inside': frac_vis, 'black_fraction_outside': frac_black, 'red_mean_inside': red_inside, 'green_median_abs_diff_vs_mapped_source': gdiff}
    check(frac_vis > 0.97, 't=%.1fs: %.1f%% of the pixels that should show the (mask + pin) region are visible' % (t, 100 * frac_vis))
    check(frac_black > 0.985, 't=%.1fs: %.1f%% of the pixels outside the masked / pinned region are black' % (t, 100 * frac_black))
    check(red_inside < 8, 't=%.1fs: curve killed the red channel inside the region (mean R %.1f)' % (t, red_inside))
    check(gdiff < 14, 't=%.1fs: green inside matches the source frame mapped through the inverse corner-pin homography (median abs diff %.1f)' % (t, gdiff))
    check(abs(extent[0] - exp_extent[0]) < 0.03 and abs(extent[1] - exp_extent[1]) < 0.03, 't=%.1fs: horizontal extent of the visible region %s matches the expected %s' % (t, tuple(round(x, 3) for x in extent), tuple(round(x, 3) for x in exp_extent)))
(t1, e1, x1), (t2, e2, x2) = extents
check(e1[1] - e2[1] > 0.04, 'the animated mask anchors move the right edge between the two exported frames (%.3f -> %.3f)' % (e1[1], e2[1]))
print(json.dumps({'checks': checks, 'numbers': numbers}, indent=1))
