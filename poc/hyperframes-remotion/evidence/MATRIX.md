# 30-component compatibility matrix (real HyperFrames 0.9.28 catalog sources, unmodified)

Measured with Remotion `@remotion/web-renderer` 4.0.540 in headless Chromium 153 (default flags) against native `hyperframes snapshot` frames at identical timestamps (15% / 50% / 90% of each duration). MP4 column = first 2 s exported at the component's native size, H.264 + AAC, verified with ffprobe.

**Classification rules** (applied by `build-matrix.py` from recorded data):
- **DIRECT**: no compatibility transform engaged (a block may still load its Google Fonts).
- **GENERIC ADAPTER**: one or more reusable transforms engaged (`rebased` relative assets, `blurs` box-clipped blur shapes, `bars` inset-shadow bars, `blurs` box-clipped blur shapes, `rasters` off-centre radial gradients, `layersSplit` stacked gradients, `videos` video bridge). No per-block code.
- **(partial)**: lowest of the three SSIM samples is below 0.95.
- **SPECIAL HANDLING NEEDED**: renders but content differs; needs component-specific work.
- **UNSUPPORTED**: cannot render, or key visuals missing, with a verified cause.

SSIM column = three samples. `motion` = largest frame-to-frame change across samples (0.0 can be legitimate when the component is settled at all three times). `alpha` = lowest alpha seen (0 = transparent regions preserved).

| Component | Category | Type | Size | SSIM @15/50/90% | motion | alpha | MP4 | Transforms engaged | Fonts | Class | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lt-clean-bar | lower third | block | 1920x1080 | 1.00/1.00/1.00 | 0.0 | 0 | 60f 1920x1080 | - | Montserrat | **DIRECT** |  |
| lt-bold-block | lower third | block | 1920x1080 | 1.00/1.00/1.00 | 0.0 | 0 | 60f 1920x1080 | - | Archivo Black, Space Mono | **DIRECT** |  |
| lt-neon-border | lower third | block | 1920x1080 | 0.97/0.99/0.98 | 7.1 | 8 | 60f 1920x1080 | - | Inter | **DIRECT** |  |
| yt-lower-third | lower third | block | 1920x1080 | 0.99/0.99/1.00 | 10.7 | 0 | 60f 1920x1080 | rebased | DM Sans | **GENERIC ADAPTER** |  |
| hw-title | kinetic typography | block | 1920x1080 | 0.96/0.99/0.97 | 2.6 | 0 | 60f 1920x1080 | - | Caveat | **DIRECT** | 0.96 at the first sample. |
| hw-write-title | kinetic typography | block | 1920x1080 | 1.00/0.99/0.97 | 0.0 | 0 | 60f 1920x1080 | - | Caveat | **DIRECT** |  |
| apple-money-count | kinetic typography | block | 1920x1080 | 0.97/0.97/0.95 | 15.6 | 255 | 60f 1920x1080 | rebased, rasters | - | **GENERIC ADAPTER** | 0.95 at the last sample; counter/icon burst timing not diagnosed. |
| caption-kinetic-slam | animated captions | component | 1920x1080 | 0.99/0.97/0.97 | 11.3 | 0 | 60f 1920x1080 | - | Anton | **DIRECT** |  |
| caption-pill-karaoke | animated captions | component | 1920x1080 | 0.98/0.99/1.00 | 15.4 | 0 | 60f 1920x1080 | - | Poppins | **DIRECT** |  |
| caption-highlight | animated captions | component | 1920x1080 | 0.99/0.99/0.99 | 8.3 | 0 | 60f 1920x1080 | - | Montserrat | **DIRECT** |  |
| caption-neon-glow | animated captions | component | 1920x1080 | 0.98/0.99/0.99 | 13.0 | 0 | 60f 1920x1080 | - | Outfit | **DIRECT** |  |
| instagram-follow | social overlay | block | 1080x1920 | 0.98/0.98/1.00 | 2.5 | 0 | 60f 1080x1920 | rebased | DM Sans | **GENERIC ADAPTER** |  |
| tiktok-follow | social overlay | block | 1080x1920 | 0.98/0.98/1.00 | 2.9 | 0 | 60f 1080x1920 | rebased | DM Sans | **GENERIC ADAPTER** |  |
| reddit-post | social overlay | block | 1920x1080 | 0.99/0.99/1.00 | 6.3 | 0 | 60f 1920x1080 | - | DM Sans | **DIRECT** |  |
| spotify-card | social overlay | block | 1080x1920 | 0.99/0.99/0.99 | 2.0 | 69 | 60f 1080x1920 | - | Inter | **DIRECT** |  |
| ai-answer-rank | business promo | block | 1080x1080 | 0.99/0.99/0.92 | 1.5 | 255 | 60f 1080x1080 | - | Inter | **DIRECT (partial)** | Matches early (0.99); last sample (t=90%) is 0.92. Not diagnosed. |
| slack-notification-ad | business promo | block | 1080x1920 | 0.95/0.96/0.95 | 3.9 | 255 | 60f 1080x1920 | rebased, rasters | - | **GENERIC ADAPTER** | Needed timeline-settle wait, radial-gradient rasterizing (wallpaper) and CORS images. Fixed from 0.002 to 0.95. |
| heygen-avatar-promo-card | business promo | block | 1080x1920 | 0.98/0.98/0.98 | 36.3 | 255 | 60f 1080x1920 | rebased, videos | - | **GENERIC ADAPTER** | Needed the <video> bridge (3 of 5 tiles are video). Frames match closely; tiny pose offsets from seek precision. |
| carousel-circle-1 | image animation | block | 1920x1080 | 0.90/0.98/0.99 | 11.5 | 255 | 60f 1920x1080 | rebased | Inter | **GENERIC ADAPTER (partial)** | Matches at later times (0.98); first sample (t=15%) is 0.90. Early-frame mismatch not diagnosed. |
| carousel-path-2 | image animation | block | 1920x1080 | 0.85/0.97/0.98 | 21.0 | 255 | 60f 1920x1080 | rebased | Inter | **GENERIC ADAPTER (partial)** | Matches at later times (0.97); first sample (t=15%) is 0.85. Early-frame mismatch not diagnosed. |
| cinemagraph | image animation | block | 1920x1080 | 0.95/0.95/0.95 | 0.4 | 255 | 60f 1920x1080 | rasters | - | **GENERIC ADAPTER** | Motion is subtle by design (one living region). |
| chromatic-radial-split | transition | block | 1920x1080 | 0.99/0.99/0.99 | 30.0 | 255 | 60f 1920x1080 | layersSplit | Space Mono, Bebas Neue, JetBrains Mono, Lato | **GENERIC ADAPTER** |  |
| flash-through-white | transition | block | 1920x1080 | 0.96/0.95/0.95 | 154.4 | 255 | 60f 1920x1080 | layersSplit | Space Mono, Bebas Neue, JetBrains Mono, Lato | **GENERIC ADAPTER** |  |
| glitch | transition | block | 1920x1080 | 0.99/0.99/0.99 | 32.5 | 255 | 60f 1920x1080 | layersSplit | Space Mono, Bebas Neue, JetBrains Mono, Lato | **GENERIC ADAPTER** |  |
| bar-chart-race | GSAP animation | block | 1920x1080 | 0.98/0.98/0.98 | 4.2 | 255 | 60f 1920x1080 | - | Inter | **DIRECT** |  |
| code-diff | GSAP animation | block | 1920x1080 | 0.95/0.95/0.95 | 1.7 | 255 | 60f 1920x1080 | bars, rasters, layersSplit, blurs | JetBrains Mono | **GENERIC ADAPTER (partial)** | Needed the inset-shadow bar and blurred-shape transforms (renderer clips `filter: blur()` to the element box). Residual: PSNR 31.4 dB, mean abs diff 3.1/255, 0.54% of pixels off by >16 levels (low-amplitude gradient differences). |
| vfx-liquid-glass | canvas animation | block | 1920x1080 | 0.74/0.75/0.75 | 20.3 | 255 | 60f 1920x1080 | - | Inter | **SPECIAL HANDLING NEEDED** | three.js glass renders but the captured backdrop content differs from native (different text shown). Not diagnosed. |
| vfx-shatter | canvas animation | block | 1920x1080 | n/a | 0.0 | 255 | FAIL | - | Inter | **UNSUPPORTED** | Needs experimental drawElementImage (HTML-in-canvas); absent in this Chromium and native HyperFrames fails too. No reference. |
| code-3d-extrude | WebGL effect | block | 1920x1080 | 1.00/1.00/1.00 | 3.2 | 255 | 60f 1920x1080 | - | - | **DIRECT** | WebGL slab matches (1.0). |
| camera-dolly-zoom | WebGL effect | block | 1920x1080 | 0.50/0.52/0.51 | 0.0 | 255 | 60f 1920x1080 | - | Inter | **UNSUPPORTED** | CSS 3D (perspective/translateZ) is flattened by the renderer: depth frames missing. Verified in isolation (src/diag.jsx). |

**Totals**: DIRECT: 14, GENERIC ADAPTER: 13, SPECIAL HANDLING NEEDED: 1, UNSUPPORTED: 2. Renderable stills: 29/30. MP4 export OK: 29/30.
