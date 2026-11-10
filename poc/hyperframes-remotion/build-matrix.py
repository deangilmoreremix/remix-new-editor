"""Builds MATRIX.md from measured data: out/sweep-table.json (SSIM/motion/alpha), out/blocks.json (engaged transforms),
out/exports/results-sweep.json (MP4 export). Classification rules are printed in the file."""
import json, os
T = {r['name']: r for r in json.load(open('out/sweep-table.json'))}
B = json.load(open('out/blocks.json'))
E = {r['label'].replace('sweep-', ''): r for r in json.load(open('out/exports/results-sweep.json'))}
NOTES = {
 'code-diff': 'Needed the inset-shadow bar and blurred-shape transforms (renderer clips `filter: blur()` to the element box). Residual: PSNR 31.4 dB, mean abs diff 3.1/255, 0.54% of pixels off by >16 levels (low-amplitude gradient differences).',
 'slack-notification-ad': 'Needed timeline-settle wait, radial-gradient rasterizing (wallpaper) and CORS images. Fixed from 0.002 to 0.95.',
 'heygen-avatar-promo-card': 'Needed the <video> bridge (3 of 5 tiles are video). Frames match closely; tiny pose offsets from seek precision.',
 'vfx-liquid-glass': 'three.js glass renders but the captured backdrop content differs from native (different text shown). Not diagnosed.',
 'camera-dolly-zoom': 'CSS 3D (perspective/translateZ) is flattened by the renderer: depth frames missing. Verified in isolation (src/diag.jsx).',
 'vfx-shatter': 'Needs experimental drawElementImage (HTML-in-canvas); absent in this Chromium and native HyperFrames fails too. No reference.',
 'cinemagraph': 'Motion is subtle by design (one living region).',
 'carousel-circle-1': 'Matches at later times (0.98); first sample (t=15%) is 0.90. Early-frame mismatch not diagnosed.',
 'carousel-path-2': 'Matches at later times (0.97); first sample (t=15%) is 0.85. Early-frame mismatch not diagnosed.',
 'ai-answer-rank': 'Matches early (0.99); last sample (t=90%) is 0.92. Not diagnosed.',
 'apple-money-count': '0.95 at the last sample; counter/icon burst timing not diagnosed.',
 'hw-title': '0.96 at the first sample.',
 'code-3d-extrude': 'WebGL slab matches (1.0).',
}
UNSUP = {'vfx-shatter', 'camera-dolly-zoom'}; SPECIAL = {'vfx-liquid-glass'}
rows = []
for n, t in T.items():
    info = (B.get(n) or {}).get('hfInfo') or {}
    eng = [k for k in ('rebased', 'bars', 'rasters', 'layersSplit', 'videos', 'blurs') if info.get(k)]
    fonts = info.get('fonts') or []
    smin = min(t['ssim']) if t['ssim'] else None
    if n in UNSUP: cls = 'UNSUPPORTED'
    elif n in SPECIAL: cls = 'SPECIAL HANDLING NEEDED'
    elif smin is None: cls = 'UNSUPPORTED'
    elif eng: cls = 'GENERIC ADAPTER' + (' (partial)' if smin < 0.95 else '')
    else: cls = 'DIRECT' + (' (partial)' if smin < 0.95 else '')
    e = E.get(n, {}); ex = f"{e['video']['frames']}f {e['video']['w']}x{e['video']['h']}" if e.get('ok') else 'FAIL'
    rows.append((n, t['category'], t['type'], t['dims'], ('/'.join(f'{x:.2f}' for x in t['ssim']) if t['ssim'] else 'n/a'), t['motion'], t['alpha_min'], ex, ', '.join(eng) or '-', ', '.join(fonts) or '-', cls, NOTES.get(n, '')))
out = ["# 30-component compatibility matrix (real HyperFrames 0.9.28 catalog sources, unmodified)\n",
 "Measured with Remotion `@remotion/web-renderer` 4.0.540 in headless Chromium 153 (default flags) against native `hyperframes snapshot` frames at identical timestamps (15% / 50% / 90% of each duration). MP4 column = first 2 s exported at the component's native size, H.264 + AAC, verified with ffprobe.\n",
 "**Classification rules** (applied by `build-matrix.py` from recorded data):",
 "- **DIRECT**: no compatibility transform engaged (a block may still load its Google Fonts).",
 "- **GENERIC ADAPTER**: one or more reusable transforms engaged (`rebased` relative assets, `blurs` box-clipped blur shapes, `bars` inset-shadow bars, `blurs` box-clipped blur shapes, `rasters` off-centre radial gradients, `layersSplit` stacked gradients, `videos` video bridge). No per-block code.",
 "- **(partial)**: lowest of the three SSIM samples is below 0.95.",
 "- **SPECIAL HANDLING NEEDED**: renders but content differs; needs component-specific work.",
 "- **UNSUPPORTED**: cannot render, or key visuals missing, with a verified cause.\n",
 "SSIM column = three samples. `motion` = largest frame-to-frame change across samples (0.0 can be legitimate when the component is settled at all three times). `alpha` = lowest alpha seen (0 = transparent regions preserved).\n",
 "| Component | Category | Type | Size | SSIM @15/50/90% | motion | alpha | MP4 | Transforms engaged | Fonts | Class | Notes |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for r in rows: out.append('| ' + ' | '.join(str(x) for x in (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], '**' + r[10] + '**', r[11])) + ' |')
from collections import Counter
c = Counter(r[10].split(' (')[0] for r in rows)
out.append('\n**Totals**: ' + ', '.join(f'{k}: {v}' for k, v in c.items()) + f'. Renderable stills: {sum(1 for r in rows if r[4] != "n/a")}/30. MP4 export OK: {sum(1 for r in rows if r[7] != "FAIL")}/30.')
open('MATRIX.md', 'w').write('\n'.join(out) + '\n'); print('\n'.join(out[-3:]))
