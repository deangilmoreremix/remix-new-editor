# HyperFrames compatibility matrix

Generated from `src/lib/hyperframes/catalog.classification.json` + evidence in `docs/evidence-hyperframes/`. Pinned upstream `cda84222aa12716f2ceb92b45629487be81a0601`.

## Totals

| Group | Count |
|---|---|
| Blocks total | 210 |
| Blocks: verified-export | 86 |
| Blocks: adapter-compatible | 41 |
| Blocks: specialized | 32 |
| Blocks: unsupported | 51 |
| **Blocks enabled for customers** | **49** (of 86 verified) |
| Components total | 238 |
| Components: render-tested, renders-and-animates | 146 |
| Components: render-tested, static | 53 |
| Components: render-tested, adapter-errors | 34 |
| Components: render-tested, blank | 5 |
| **Components verified against a native reference** | **0** |
| **Starter projects verified** | **0** (of 9) |

## Blocks

| Block | Status | Enabled | Prod-path SSIM min | Export fps | Editable fields | Reason / blocker |
|---|---|---|---|---|---|---|
| ai-answer-rank | adapter-compatible | no |  | 16.0 |  | worst-sample SSIM 0.923; exports, with visible differences |
| ai-chat-reveal | verified-export | no |  | 5.1 |  | export throughput 5.1 fps < 8.0; not yet rendered through the production adapter path |
| app-showcase | unsupported | no |  |  |  | needs a resource from a host that is not allow-listed: blocked-url src: host not allow-listed: cdn.jsdelivr.net: https://cdn.jsdelivr.net/np |
| apple-money-count | adapter-compatible | no |  | 18.1 |  | worst-sample SSIM 0.950; exports, with visible differences |
| aurora | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline aurora: no __timelines entry (data-no-timeline |
| bar-chart-race | verified-export | yes | 0.993 | 19.1 | 11 | SSIM >= 0.95 at all samples; MP4 export OK |
| beat-freeze-cut | specialized | no |  |  |  | renders, but worst-sample SSIM 0.792: content differs from native (export not attempted) |
| blob | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline blob: no __timelines entry (data-no-timeline b |
| blue-sweater-intro-video | verified-export | no |  | 11.2 |  | audio element; no editable fields detected; not yet rendered through the production adapter path |
| camcorder-hud | verified-export | yes | 0.997 | 41.3 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| camera-dolly-zoom | specialized | no |  |  |  | renders, but worst-sample SSIM 0.497: content differs from native (export not attempted) |
| canopy-part-title | verified-export | no |  | 27.9 |  | WebGL; three.js; not yet rendered through the production adapter path |
| carousel-circle-1 | adapter-compatible | no |  | 28.0 |  | worst-sample SSIM 0.896; exports, with visible differences |
| carousel-circle-2 | adapter-compatible | no |  | 26.3 |  | worst-sample SSIM 0.886; exports, with visible differences |
| carousel-circle-3 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.815: content differs from native (export not attempted) |
| carousel-circle-4 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.786: content differs from native (export not attempted) |
| carousel-circle-5 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.586: content differs from native (export not attempted) |
| carousel-orbit-1 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.834: content differs from native (export not attempted) |
| carousel-orbit-2 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.837: content differs from native (export not attempted) |
| carousel-orbit-3 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.792: content differs from native (export not attempted) |
| carousel-orbit-4 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.796: content differs from native (export not attempted) |
| carousel-orbit-5 | adapter-compatible | no |  | 1.5 |  | worst-sample SSIM 0.889; exports, with visible differences |
| carousel-path-1 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.850: content differs from native (export not attempted) |
| carousel-path-2 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.848: content differs from native (export not attempted) |
| carousel-path-3 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.785: content differs from native (export not attempted) |
| carousel-path-4 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.837: content differs from native (export not attempted) |
| carousel-path-5 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.827: content differs from native (export not attempted) |
| carousel-text-circle-1 | adapter-compatible | no |  | 12.5 |  | worst-sample SSIM 0.931; exports, with visible differences |
| carousel-text-circle-2 | adapter-compatible | no |  | 11.6 |  | worst-sample SSIM 0.943; exports, with visible differences |
| carousel-text-circle-3 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.746: content differs from native (export not attempted) |
| carousel-text-circle-4 | adapter-compatible | no |  | 12.1 |  | worst-sample SSIM 0.891; exports, with visible differences |
| carousel-text-circle-5 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.665: content differs from native (export not attempted) |
| carousel-vision-1 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.776: content differs from native (export not attempted) |
| carousel-vision-2 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.762: content differs from native (export not attempted) |
| carousel-vision-3 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.759: content differs from native (export not attempted) |
| carousel-vision-4 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.783: content differs from native (export not attempted) |
| carousel-vision-5 | specialized | no |  |  |  | renders, but worst-sample SSIM 0.537: content differs from native (export not attempted) |
| chatgpt-exchange | adapter-compatible | no |  | 4.3 |  | worst-sample SSIM 0.894; exports, with visible differences |
| chromatic-radial-split | verified-export | no |  | 12.3 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| chrome-orb | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline chrome-orb: no __timelines entry (data-no-time |
| cinemagraph | verified-export | no |  | 30.6 |  | video element; unseeded Math.random; no editable fields detected; not yet rendered through the production adapter path |
| cinematic-zoom | verified-export | no |  | 5.6 |  | WebGL; export throughput 5.6 fps < 8.0; no editable fields detected; not yet rendered through the production adapter path |
| claude-exchange | adapter-compatible | no |  | 2.3 |  | worst-sample SSIM 0.900; exports, with visible differences |
| code-3d-extrude | verified-export | no |  | 16.3 |  | WebGL; three.js; no editable fields detected; not yet rendered through the production adapter path |
| code-diff | adapter-compatible | no |  | 12.2 |  | worst-sample SSIM 0.947; exports, with visible differences |
| code-highlight | adapter-compatible | no |  | 9.8 |  | worst-sample SSIM 0.944; exports, with visible differences |
| code-morph | adapter-compatible | no |  | 9.8 |  | worst-sample SSIM 0.948; exports, with visible differences |
| code-particle-assemble | verified-export | no |  | 19.2 |  | WebGL; three.js; no editable fields detected; not yet rendered through the production adapter path |
| code-scroll | adapter-compatible | no |  | 4.7 |  | worst-sample SSIM 0.931; exports, with visible differences |
| code-shader-dissolve | verified-export | no |  | 13.6 |  | WebGL; three.js; no editable fields detected; not yet rendered through the production adapter path |
| code-slice-hero | unsupported | no |  |  |  | a block script failed to run: script assets/gsap-3.14.2.min.js: Unexpected token '<' |
| code-snippet-apple-terminal-pro | verified-export | yes | 0.974 | 8.9 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| code-snippet-dark-2026 | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline code-snippet-dark-2026: no __timelines entry |
| code-snippet-dark-modern | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline code-snippet-dark-modern: no __timelines entry |
| code-typing | adapter-compatible | no |  | 10.8 |  | worst-sample SSIM 0.945; exports, with visible differences |
| color-wheel | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline color-wheel: no __timelines entry (data-no-tim |
| cosmic-orb | verified-export | no |  | 2.9 |  | WebGL; export throughput 2.9 fps < 8.0; not yet rendered through the production adapter path |
| cross-warp-morph | verified-export | no |  | 10.1 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| cuboid-carousel | unsupported | no |  |  |  | a block script failed to run: script assets/gsap-3.14.2.min.js: Unexpected token '<' |
| data-chart | adapter-compatible | no |  | 21.6 |  | worst-sample SSIM 0.926; exports, with visible differences |
| domain-warp-dissolve | verified-export | no |  | 9.1 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| editorial-flash-overlay | verified-export | yes | 1.0 | 49.5 | 0 | SSIM >= 0.95 at all samples; MP4 export OK |
| exploded-stack | adapter-compatible | no |  | 27.7 |  | worst-sample SSIM 0.921; exports, with visible differences |
| extruded-logo | specialized | no |  |  |  | renders, but worst-sample SSIM 0.839: content differs from native (export not attempted) |
| falling-lines | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline falling-lines: no __timelines entry (data-no-t |
| flash-through-white | verified-export | no |  | 13.9 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| flowchart | adapter-compatible | no |  | 17.4 |  | worst-sample SSIM 0.947; exports, with visible differences |
| flowchart-vertical | adapter-compatible | no |  | 16.3 |  | worst-sample SSIM 0.950; exports, with visible differences |
| flowing-gradient | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline flowing-gradient: no __timelines entry (data-n |
| fractal-noise | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline fractal-noise: no __timelines entry (data-no-t |
| freeze-frame-dressing | specialized | no | 0.823 | 34.7 |  | production adapter path worst-sample SSIM 0.823 (research harness reached 0.977) |
| frost | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline frost: no __timelines entry (data-no-timeline  |
| frost-sequence-camera-orbit | unsupported | no |  |  |  | a block script failed to run: script assets/gsap-3.14.2.min.js: Unexpected token '<' |
| gabor-noise | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline gabor-noise: no __timelines entry (data-no-tim |
| gallery-tunnel | verified-export | no |  | 11.1 |  | WebGL; three.js; sub-composition; not yet rendered through the production adapter path |
| glass-hero | specialized | no |  |  |  | renders, but worst-sample SSIM 0.838: content differs from native (export not attempted) |
| glass-shard-title | unsupported | no |  |  |  | a block script failed to run: script assets/glass-main.js: Unexpected token '<' |
| glitch | verified-export | no |  | 13.1 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| godrays | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline godrays: no __timelines entry (data-no-timelin |
| goo | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline goo: no __timelines entry (data-no-timeline bl |
| gooey-split | verified-export | no |  | 5.9 |  | export throughput 5.9 fps < 8.0; no editable fields detected; not yet rendered through the production adapter path |
| gravitational-lens | adapter-compatible | no |  | 12.2 |  | worst-sample SSIM 0.898; exports, with visible differences |
| halftone-field | verified-export | no |  | 10.3 |  | WebGL; not yet rendered through the production adapter path |
| heatmap | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline heatmap: no __timelines entry (data-no-timelin |
| heygen-avatar-promo-card | verified-export | no |  | 7.8 |  | video element; audio element; asset files hosted remotely (not pinned/vendored); export throughput 7.8 fps < 8.0; not yet rendered through t |
| hologram | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline hologram: no __timelines entry (data-no-timeli |
| holographic | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline holographic: no __timelines entry (data-no-tim |
| hw-frame | specialized | no |  |  |  | renders, but worst-sample SSIM 0.663: content differs from native (export not attempted) |
| hw-path-text | verified-export | yes | 0.991 | 28.0 | 8 | SSIM >= 0.95 at all samples; MP4 export OK |
| hw-pipeline | verified-export | no |  | 29.2 |  | shows built-in text that cannot be edited; not yet rendered through the production adapter path |
| hw-scribble-transition | adapter-compatible | no |  | 44.0 |  | worst-sample SSIM 0.928; exports, with visible differences |
| hw-text-cloud | adapter-compatible | no |  | 25.7 |  | worst-sample SSIM 0.944; exports, with visible differences |
| hw-title | verified-export | yes | 0.957 | 30.8 | 12 | SSIM >= 0.95 at all samples; MP4 export OK |
| hw-write-title | verified-export | yes | 0.996 | 31.5 | 7 | SSIM >= 0.95 at all samples; MP4 export OK |
| instagram-follow | verified-export | yes | 0.986 | 30.0 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| ios26-liquid-glass | verified-export | no |  | 7.0 |  | WebGL; three.js; HTML-in-canvas API; export throughput 7.0 fps < 8.0; no editable fields detected; not yet rendered through the production a |
| lens-flare | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline lens-flare: no __timelines entry (data-no-time |
| light-edge | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline light-edge: no __timelines entry (data-no-time |
| light-leak | adapter-compatible | no |  | 13.8 |  | worst-sample SSIM 0.906; exports, with visible differences |
| liquid-glass-notification | unsupported | no |  |  |  | a block script failed to run: script liquid-glass-notification#inline: LiquidGlass is not defined |
| liquid-glass-widgets | unsupported | no |  |  |  | a block script failed to run: script liquid-glass-widgets#inline: LiquidGlass is not defined |
| liquid-metal | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline liquid-metal: no __timelines entry (data-no-ti |
| logo-outro | verified-export | yes | 1.0 | 32.7 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lottie-character-walk | verified-export | no | 0.996 | 45.1 |  | adapter reported errors in the production render |
| lower-third-bild | verified-export | yes | 1.0 | 41.1 | 4 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-accent-underline | verified-export | yes | 0.997 | 39.8 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-bold-block | verified-export | yes | 0.999 | 33.1 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-clean-bar | verified-export | yes | 0.999 | 38.9 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-color-block | verified-export | yes | 0.973 | 37.9 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-dark-card | verified-export | yes | 0.998 | 40.0 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-kicker-name | verified-export | yes | 0.998 | 35.4 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-mask-reveal | verified-export | yes | 0.996 | 41.8 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-neon-border | verified-export | yes | 0.957 | 12.5 | 9 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-side-rule | verified-export | yes | 0.997 | 37.5 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-soft-pill | verified-export | yes | 0.993 | 35.0 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| lt-stack-bars | verified-export | yes | 0.999 | 35.7 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| macos-notification | verified-export | yes | 0.997 | 30.3 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| macos-tahoe-liquid-glass | adapter-compatible | no |  | 5.8 |  | worst-sample SSIM 0.862; exports, with visible differences |
| marble | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline marble: no __timelines entry (data-no-timeline |
| mesh-gradient | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline mesh-gradient: no __timelines entry (data-no-t |
| message-thread-reveal | adapter-compatible | no |  | 1.8 |  | worst-sample SSIM 0.927; exports, with visible differences |
| mk-background | verified-export | yes | 1.0 | 29.3 | 8 | SSIM >= 0.95 at all samples; MP4 export OK |
| mk-callout-highlight | verified-export | yes | 0.992 | 38.5 | 7 | SSIM >= 0.95 at all samples; MP4 export OK |
| mk-clone-wall-transition | verified-export | no |  | 9.4 |  | shows built-in text that cannot be edited; not yet rendered through the production adapter path |
| mk-line-graph | verified-export | no |  | 31.1 |  | shows built-in text that cannot be edited; not yet rendered through the production adapter path |
| mk-placeholder-grid | verified-export | yes | 0.995 | 24.0 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| mk-progress-stat | verified-export | yes | 0.994 | 43.9 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| mk-specs-list | verified-export | no |  | 35.8 |  | shows built-in text that cannot be edited; not yet rendered through the production adapter path |
| nebula | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline nebula: no __timelines entry (data-no-timeline |
| news-ticker | adapter-compatible | no |  | 9.1 |  | worst-sample SSIM 0.929; exports, with visible differences |
| north-korea-locked-down | adapter-compatible | no |  | 9.9 |  | worst-sample SSIM 0.881; exports, with visible differences |
| notes-reveal | verified-export | no |  | 5.1 |  | export throughput 5.1 fps < 8.0; not yet rendered through the production adapter path |
| notification-cascade | verified-export | yes | 0.967 | 16.7 | 4 | SSIM >= 0.95 at all samples; MP4 export OK |
| nyc-paris-flight | adapter-compatible | no |  | 9.3 |  | worst-sample SSIM 0.897; exports, with visible differences |
| obsidian | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline obsidian: no __timelines entry (data-no-timeli |
| orbit-card | unsupported | no |  |  |  | a block script failed to run: script assets/gsap-3.14.2.min.js: Unexpected token '<' |
| organic-light-leak-overlay | specialized | no |  |  |  | renders, but worst-sample SSIM 0.733: content differs from native (export not attempted) |
| oscilloscope-trace | verified-export | yes | 0.999 | 15.2 | 11 | SSIM >= 0.95 at all samples; MP4 export OK |
| plasma | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline plasma: no __timelines entry (data-no-timeline |
| plastic | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline plastic: no __timelines entry (data-no-timelin |
| prism | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline prism: no __timelines entry (data-no-timeline  |
| product-turntable | adapter-compatible | no |  | 30.0 |  | worst-sample SSIM 0.906; exports, with visible differences |
| rack-focus | verified-export | no |  | 7.8 |  | WebGL; export throughput 7.8 fps < 8.0; not yet rendered through the production adapter path |
| reddit-post | verified-export | yes | 0.998 | 19.1 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| ridged-burn | verified-export | no |  | 12.2 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| ripple-waves | verified-export | no |  | 14.8 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| ripples | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline ripples: no __timelines entry (data-no-timelin |
| sdf-iris | adapter-compatible | no |  | 14.7 |  | worst-sample SSIM 0.909; exports, with visible differences |
| share-sheet-carousel | verified-export | no | 0.997 | 10.4 |  | shows built-in text that cannot be edited |
| sine-wave | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline sine-wave: no __timelines entry (data-no-timel |
| slack-notification-ad | verified-export | yes | 0.966 | 17.1 | 5 | SSIM >= 0.95 at all samples; MP4 export OK |
| snow | verified-export | yes | 0.985 | 25.9 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| spain-map | verified-export | yes | 1.0 | 24.4 | 5 | SSIM >= 0.95 at all samples; MP4 export OK |
| spiral | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline spiral: no __timelines entry (data-no-timeline |
| spiral-galaxy | verified-export | no |  | 12.4 |  | WebGL; three.js; not yet rendered through the production adapter path |
| split-flap-board | verified-export | no | 0.995 | 10.8 |  | no editable field with a measured visible effect |
| spotify-card | adapter-compatible | no | 0.929 | 17.3 |  | production adapter path worst-sample SSIM 0.929 (research harness reached 0.986) |
| starfield | verified-export | yes | 0.993 | 17.1 | 1 | SSIM >= 0.95 at all samples; MP4 export OK |
| strands | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline strands: no __timelines entry (data-no-timelin |
| stripes | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline stripes: no __timelines entry (data-no-timelin |
| sun-burst | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline sun-burst: no __timelines entry (data-no-timel |
| swirl | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline swirl: no __timelines entry (data-no-timeline  |
| swirl-vortex | verified-export | no |  | 12.9 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| thermal-distortion | verified-export | no |  | 10.4 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| thin-film | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline thin-film: no __timelines entry (data-no-timel |
| thread-message-stack | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline thread-message-stack: no __timelines entry |
| tiktok-follow | verified-export | yes | 0.987 | 33.7 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-3d | adapter-compatible | no |  | 23.7 |  | worst-sample SSIM 0.864; exports, with visible differences |
| transitions-blur | verified-export | yes | 0.998 | 22.1 | 3 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-cover | verified-export | yes | 0.998 | 20.9 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-destruction | adapter-compatible | no |  | 22.6 |  | worst-sample SSIM 0.858; exports, with visible differences |
| transitions-dissolve | verified-export | yes | 0.999 | 21.8 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-distortion | verified-export | yes | 0.997 | 24.4 | 3 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-grid | verified-export | yes | 0.998 | 23.9 | 3 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-light | verified-export | yes | 0.998 | 19.2 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-mechanical | adapter-compatible | no |  | 21.8 |  | worst-sample SSIM 0.857; exports, with visible differences |
| transitions-other | verified-export | yes | 0.999 | 21.3 | 3 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-push | verified-export | yes | 0.999 | 22.6 | 2 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-radial | verified-export | yes | 0.999 | 21.1 | 4 | SSIM >= 0.95 at all samples; MP4 export OK |
| transitions-scale | adapter-compatible | no |  | 23.2 |  | worst-sample SSIM 0.863; exports, with visible differences |
| ui-3d-reveal | specialized | no |  |  |  | renders, but worst-sample SSIM 0.825: content differs from native (export not attempted) |
| us-map | adapter-compatible | no |  | 19.4 |  | worst-sample SSIM 0.895; exports, with visible differences |
| us-map-bubble | specialized | no |  |  |  | renders, but worst-sample SSIM 0.769: content differs from native (export not attempted) |
| us-map-flow | specialized | no |  |  |  | renders, but worst-sample SSIM 0.803: content differs from native (export not attempted) |
| us-map-hex | verified-export | yes | 0.996 | 28.7 | 4 | SSIM >= 0.95 at all samples; MP4 export OK |
| vfx-anamorphic-flare | verified-export | yes | 1.0 | 16.7 | 7 | SSIM >= 0.95 at all samples; MP4 export OK |
| vfx-iphone-device | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline vfx-iphone-device: no __timelines entry |
| vfx-liquid-background | unsupported | no |  |  |  | needs a resource from a host that is not allow-listed: blocked-url src: host not allow-listed: cdn.jsdelivr.net: https://cdn.jsdelivr.net/np |
| vfx-liquid-glass | specialized | no |  |  |  | renders, but worst-sample SSIM 0.744: content differs from native (export not attempted) |
| vfx-magnetic | verified-export | no |  | 10.6 |  | WebGL; HTML-in-canvas API; no editable fields detected; not yet rendered through the production adapter path |
| vfx-portal | specialized | no |  |  |  | renders, but worst-sample SSIM 0.000: content differs from native (export not attempted) |
| vfx-shatter | unsupported | no |  |  |  | the block failed to mount: mount vfx-shatter: ctxA.drawElementImage is not a function |
| vfx-text-cursor | unsupported | no |  |  |  | MP4 export failed: export timeout |
| voronoi | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline voronoi: no __timelines entry (data-no-timelin |
| vpn-youtube-spot | adapter-compatible | no |  | 7.0 |  | worst-sample SSIM 0.919; exports, with visible differences |
| water | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline water: no __timelines entry (data-no-timeline  |
| waveform | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline waveform: no __timelines entry (data-no-timeli |
| week-in-merges | verified-export | yes | 0.991 | 22.5 | 7 | SSIM >= 0.95 at all samples; MP4 export OK |
| weight-wave | adapter-compatible | no |  | 24.4 |  | worst-sample SSIM 0.927; exports, with visible differences |
| whip-pan | verified-export | no |  | 10.4 |  | WebGL; no editable fields detected; not yet rendered through the production adapter path |
| wireframe-portal-title | adapter-compatible | no |  | 24.3 |  | worst-sample SSIM 0.930; exports, with visible differences |
| world-map | specialized | no |  |  |  | renders, but worst-sample SSIM 0.688: content differs from native (export not attempted) |
| worley-noise | unsupported | no |  |  |  | no seekable GSAP timeline registered (e.g. shader-driven blocks without a timeline): timeline worley-noise: no __timelines entry (data-no-ti |
| x-post | verified-export | yes | 0.992 | 15.3 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| yt-comment-card | verified-export | no |  | 24.7 |  | shows built-in text that cannot be edited; not yet rendered through the production adapter path |
| yt-lcd-background | adapter-compatible | no |  | 3.9 |  | worst-sample SSIM 0.908; exports, with visible differences |
| yt-logo-intro | verified-export | yes | 0.999 | 13.7 | 6 | SSIM >= 0.95 at all samples; MP4 export OK |
| yt-lower-third | verified-export | yes | 0.999 | 32.7 | 4 | SSIM >= 0.95 at all samples; MP4 export OK |
| yt-prism-title | adapter-compatible | no |  | 4.6 |  | worst-sample SSIM 0.948; exports, with visible differences |
| yt-vertical-fill | verified-export | no |  | 4.6 |  | export throughput 4.6 fps < 8.0; not yet rendered through the production adapter path |

## Components (production-path render test, no native reference)

Categories: `renders-and-animates` = mounted without adapter errors, non-blank, changes over time; `static` = non-blank but identical at all 3 samples (may be correct for stills or footage-dependent effects); `adapter-errors` = the adapter reported errors (mostly: no seekable timeline because the component is a transition/effect that expects a host scene); `blank`.

| Component | Category | Non-blank fractions | Motion |
|---|---|---|---|
| agent-cursor | renders-and-animates | [0.0042, 0.005, 0.0051] | 0.0101 |
| animated-bar-chart | static | [0.2309, 0.2309] | 0.0 |
| arc-motion-path | static | [0.1588, 0.1588] | 0.0 |
| ascii-render-pass | blank | [0.0, 0.0] | 0.0 |
| ascii-trail-reveal | renders-and-animates | [0.6734, 0.6734] | 0.6362 |
| aurora-drift | renders-and-animates | [0.8111, 0.8128] | 0.0226 |
| avatar-cloud | adapter-errors | [0.3594, 0.3594] | 0.0 |
| avatar-group-hover | static | [0.0041, 0.0041] | 0.0 |
| badge-pop | static | [0.0029, 0.0029] | 0.0 |
| beat-accent | static | [1.0, 1.0] | 0.0 |
| beat-pulse-background | renders-and-animates | [0.8558, 0.8201] | 0.0693 |
| beat-timeline | renders-and-animates | [0.9992, 0.9984, 0.9984] | 0.033 |
| before-after-wipe | renders-and-animates | [1.0, 1.0] | 0.1873 |
| blur-in | adapter-errors | [0.0078, 0.0078] | 0.0 |
| blur-out-up | static | [0.0018, 0.0018] | 0.0 |
| bottom-up-letters | adapter-errors | [0.0, 0.0] | 0.0 |
| browser-device-stage | renders-and-animates | [0.4991, 0.4936] | 0.0268 |
| camera-rig-depth-stack | static | [0.158, 0.158] | 0.0 |
| camera-scan-gate | renders-and-animates | [1.0, 1.0] | 0.0315 |
| camera-shake | renders-and-animates | [0.8405, 0.85] | 0.2492 |
| caption-blend-difference | adapter-errors | [0.0] | 0.0 |
| caption-camera-follow | renders-and-animates | [0.1144, 0.1245, 0.2421] | 0.2941 |
| caption-clip-wipe | renders-and-animates | [0.0137, 0.0] | 0.0137 |
| caption-editorial-emphasis | renders-and-animates | [0.0047, 0.0] | 0.0047 |
| caption-emoji-pop | renders-and-animates | [0.0128, 0.0129] | 0.0145 |
| caption-glitch-rgb | renders-and-animates | [0.0183, 0.0216] | 0.0256 |
| caption-gradient-fill | renders-and-animates | [0.0247, 0.0277] | 0.0287 |
| caption-highlight | renders-and-animates | [0.0305, 0.0] | 0.0305 |
| caption-kinetic-slam | renders-and-animates | [0.0384, 0.0291] | 0.0488 |
| caption-matrix-decode | renders-and-animates | [0.0099, 0.0074] | 0.0137 |
| caption-neon-accent | renders-and-animates | [0.0462, 0.0596] | 0.0796 |
| caption-neon-glow | renders-and-animates | [0.045, 0.0] | 0.045 |
| caption-parallax-layers | renders-and-animates | [0.1783, 0.1596] | 0.1975 |
| caption-particle-burst | renders-and-animates | [0.0218, 0.0005] | 0.0223 |
| caption-pill-karaoke | renders-and-animates | [0.049, 0.0553] | 0.0209 |
| caption-texture | blank | [0.0, 0.0] | 0.0 |
| caption-weight-shift | renders-and-animates | [0.0095, 0.0101] | 0.0141 |
| card-resize | static | [0.0215, 0.0215] | 0.0 |
| caret-swap | renders-and-animates | [0.0031, 0.0031, 0.0058] | 0.0068 |
| char-slam-explode | renders-and-animates | [0.022, 0.0353, 0.0357] | 0.0442 |
| chart-story | renders-and-animates | [0.1514, 0.1517] | 0.0208 |
| chat-message | static | [0.0267, 0.0267, 0.0267] | 0.0 |
| chat-thread | renders-and-animates | [0.0634, 0.2895] | 0.2949 |
| chromatic-aberration-wipe | static | [0.1565, 0.1565] | 0.0 |
| code-terminal-run | renders-and-animates | [0.8379, 0.8371] | 0.0128 |
| colorama-wipe | adapter-errors | [0.0, 0.0] | 0.0 |
| comparison-split | renders-and-animates | [1.0, 1.0] | 0.1209 |
| confetti | static | [0.157, 0.157] | 0.0 |
| conic-progress-ring | renders-and-animates | [0.0595, 0.0635] | 0.0189 |
| constellation-hub | renders-and-animates | [0.1012, 0.1373, 0.139] | 0.0692 |
| count-up | renders-and-animates | [0.0281, 0.0371, 0.0458] | 0.0564 |
| cta-close | renders-and-animates | [0.0617, 0.0903, 0.0903] | 0.0331 |
| cta-lockup | renders-and-animates | [0.1151, 0.1176] | 0.0286 |
| cursor-annotate | renders-and-animates | [0.0008, 0.0051, 0.0063] | 0.0065 |
| cursor-context-menu | renders-and-animates | [0.4363, 0.4365, 0.4366] | 0.0708 |
| cursor-drag-drop | renders-and-animates | [0.4619, 0.4619, 0.4619] | 0.0987 |
| cursor-glyph-trail | renders-and-animates | [0.3089, 0.3085, 0.3084] | 0.0086 |
| cursor-marquee-select | renders-and-animates | [0.4582, 0.4596, 0.4586] | 0.0978 |
| cursor-text-select | renders-and-animates | [0.3685, 0.3684, 0.3688] | 0.0363 |
| cursor-zoom-follow | renders-and-animates | [0.9995, 0.9994, 0.9995] | 0.1262 |
| curtain-reveal | renders-and-animates | [0.9585, 0.8067, 0.8067] | 0.6319 |
| cut-the-curve | renders-and-animates | [0.9996, 1.0, 0.999] | 0.0221 |
| dart-cursor | renders-and-animates | [0.0013, 0.001, 0.0011] | 0.0024 |
| decline-chart | renders-and-animates | [0.9994, 0.293] | 0.4915 |
| device-frame-stage | renders-and-animates | [0.2106, 0.2116] | 0.0046 |
| directional-wipe | static | [0.1566, 0.1566] | 0.0 |
| drift-hold | renders-and-animates | [0.304, 0.3067] | 0.0139 |
| dynamic-grid | adapter-errors | [0.0031, 0.0] | 0.0028 |
| echo-smear | adapter-errors | [0.0, 0.0] | 0.0 |
| echo-trail | renders-and-animates | [0.0381, 0.0343, 0.0284] | 0.0723 |
| extended-keyframe | adapter-errors | [0.0, 0.0] | 0.0 |
| facet-morph | renders-and-animates | [0.7862, 0.7862] | 0.0573 |
| fade-through | adapter-errors | [0.0, 0.0] | 0.0 |
| filmed-screen | adapter-errors | [1.0, 1.0] | 0.0 |
| focus-blur-resolve | static | [0.0034, 0.0034] | 0.0 |
| focus-rack | renders-and-animates | [0.8279, 0.8282, 0.8284] | 0.5018 |
| focus-swap | renders-and-animates | [0.5695, 0.57, 0.569] | 0.1061 |
| gesture-tap | renders-and-animates | [0.9974, 0.9989, 0.997] | 0.0478 |
| gloss-sweep | static | [0.165, 0.165, 0.165] | 0.0 |
| grade-split-reveal | renders-and-animates | [0.7488, 0.7959] | 0.1102 |
| grain-field | renders-and-animates | [0.7451, 0.7431] | 0.2831 |
| grain-overlay | adapter-errors | [0.67, 0.6697] | 0.005 |
| grid-card-assemble | renders-and-animates | [0.0, 0.5227, 0.5218] | 0.5227 |
| grid-pixelate-wipe | adapter-errors | [0.0, 0.0] | 0.0 |
| halftone-dissolve | renders-and-animates | [0.1183, 0.6932, 0.1183] | 0.6174 |
| headline-slam | renders-and-animates | [0.0252, 0.0249, 0.0252] | 0.0117 |
| hw-arrow | renders-and-animates | [1.0, 1.0] | 0.0022 |
| hw-boil | renders-and-animates | [1.0, 0.9998] | 0.0107 |
| hw-box-label | renders-and-animates | [1.0, 1.0] | 0.0066 |
| hw-callout-circle | renders-and-animates | [1.0, 1.0] | 0.0118 |
| hw-underline | renders-and-animates | [0.9991, 0.9993] | 0.0072 |
| icon-morph-beat | renders-and-animates | [0.0936, 0.0936, 0.0936] | 0.0041 |
| icon-swap | adapter-errors | [0.0016, 0.0016] | 0.0 |
| ink-bleed-reveal | renders-and-animates | [0.0954, 0.0127] | 0.1008 |
| inline-highlight | adapter-errors | [0.0, 0.0] | 0.0 |
| input-feedback | static | [0.0139, 0.0139] | 0.0 |
| iris-reveal | renders-and-animates | [1.0, 1.0, 1.0] | 0.8275 |
| keyframe-scrub-stack | adapter-errors | [0.1476, 0.1476] | 0.0 |
| kinetic-center-build | renders-and-animates | [0.0024, 0.0047] | 0.0048 |
| kinetic-type-swap | renders-and-animates | [0.0415, 0.0466] | 0.0248 |
| light-sweep-pass | renders-and-animates | [0.5275, 0.6477] | 0.1382 |
| line-by-line-slide | static | [0.0094, 0.0094] | 0.0 |
| line-swap | renders-and-animates | [0.0212, 0.014, 0.0313] | 0.0418 |
| locked-nucleus-orbit | renders-and-animates | [0.0603, 0.0608] | 0.028 |
| logo-brand-close | renders-and-animates | [0.0561, 0.0709] | 0.0627 |
| logo-sting | static | [0.0737, 0.0737, 0.0737] | 0.0 |
| logo-wall | static | [0.5307, 0.5307] | 0.0 |
| magnetic-cursor | renders-and-animates | [0.0632, 0.0632, 0.0632] | 0.0128 |
| marker-checklist-card | renders-and-animates | [0.2638, 0.2638, 0.2638] | 0.024 |
| marker-highlight | renders-and-animates | [0.0459, 0.0663, 0.0663] | 0.0289 |
| match-cut | renders-and-animates | [0.9999, 0.9997] | 0.029 |
| matrix-decode | static | [0.0079, 0.0079] | 0.0 |
| menu-morph | static | [0.005, 0.005] | 0.0 |
| mesh-gradient-bg | static | [0.157, 0.157] | 0.0 |
| micro-transitions | static | [0.0012, 0.0012] | 0.0 |
| mk-emphasis-type | blank | [0.0, 0.0] | 0.0 |
| mk-usage-arc | renders-and-animates | [0.0007, 0.0023] | 0.0021 |
| modal-morph | renders-and-animates | [0.0283, 0.5337] | 0.5118 |
| morph-swap | renders-and-animates | [1.0, 0.9975, 0.9975] | 0.2929 |
| morph-text | renders-and-animates | [0.9652, 0.9701] | 0.0773 |
| motion-blur | adapter-errors | [0.0, 0.0] | 0.0 |
| multi-device-splay | renders-and-animates | [0.4687, 0.4564, 0.4551] | 0.1134 |
| multiplayer-cursors | adapter-errors | [0.0212, 0.0212] | 0.0 |
| native-notification-pop | renders-and-animates | [1.0, 1.0, 1.0] | 0.0112 |
| notes-typing | static | [0.9991] | 0.0 |
| notification-pileup | adapter-errors | [1.0, 1.0] | 0.0 |
| notification-stack | renders-and-animates | [0.0863, 0.2481] | 0.1874 |
| number-pop-in | static | [0.0017, 0.0017] | 0.0 |
| number-wheel | adapter-errors | [0.0, 0.0] | 0.0 |
| offset-path-traveler | renders-and-animates | [0.0189, 0.019] | 0.0062 |
| onboarding-stepper-flow | static | [0.0666, 0.0666] | 0.0 |
| ordered-dither-pass | renders-and-animates | [1.0, 0.4764, 0.2205] | 0.9988 |
| outline-draw | static | [0.0403, 0.0403] | 0.0 |
| oversized-cursor | renders-and-animates | [0.0091, 0.0093, 0.0091] | 0.0102 |
| overwhelm-surround | renders-and-animates | [0.9996, 0.9996, 0.9996] | 0.1329 |
| page-slide | static | [0.0862, 0.0862] | 0.0 |
| pan-stations | renders-and-animates | [0.9999, 0.9999] | 0.0733 |
| panel-reveal | static | [0.021, 0.021] | 0.0 |
| paper-collage-reveal | renders-and-animates | [0.9985, 0.9989, 0.9989] | 0.6872 |
| parallax-device-dive | renders-and-animates | [0.1763, 0.1754, 0.3009] | 0.1887 |
| parallax-unzoom | adapter-errors | [0.0, 0.0] | 0.0 |
| parallax-zoom | adapter-errors | [0.0, 0.0] | 0.0 |
| particle-image-reveal | renders-and-animates | [0.0294, 0.1549] | 0.1821 |
| particle-text-dissolve | renders-and-animates | [0.0363, 0.0657] | 0.0857 |
| pendulum-swing | static | [0.0219, 0.0219] | 0.0 |
| per-word-crossfade | static | [0.0079, 0.0079] | 0.0 |
| per-word-rise | renders-and-animates | [0.0796, 0.0566, 0.0566] | 0.0567 |
| perspective-marquee | static | [0.0166, 0.0166] | 0.0 |
| physical-exit | renders-and-animates | [0.1853, 0.1845, 0.1257] | 0.311 |
| press-ripple | renders-and-animates | [0.02, 0.0204, 0.0196] | 0.0061 |
| pull-back-reveal | renders-and-animates | [0.9083, 0.8921, 0.899] | 0.4096 |
| pull-to-refresh | renders-and-animates | [0.9998, 0.9999] | 0.2792 |
| push-in | renders-and-animates | [0.9996, 0.9999] | 0.0104 |
| radial-surround | renders-and-animates | [0.0818, 0.0841] | 0.0404 |
| rgb-glitch-text | static | [0.0043, 0.0043] | 0.0 |
| rubber-band-bumper | renders-and-animates | [0.9989, 0.9985, 0.9958] | 0.2611 |
| scan-band | renders-and-animates | [0.0478, 0.0442, 0.0442] | 0.0071 |
| scramble-reveal | renders-and-animates | [0.3038, 0.3038, 0.3039] | 0.0343 |
| screen-flow-carousel | renders-and-animates | [0.4167, 0.355] | 0.292 |
| scroll-camera-story | renders-and-animates | [0.5532, 0.6136, 0.6011] | 0.129 |
| scroll-feed | renders-and-animates | [1.0, 1.0] | 0.3622 |
| segmentation-flood | renders-and-animates | [1.0, 1.0, 1.0] | 0.3695 |
| separator | adapter-errors | [0.0007, 0.0007] | 0.0 |
| settings-toggle-flow | static | [0.0704, 0.0704] | 0.0 |
| shared-axis-y | static | [0.0045, 0.0045] | 0.0 |
| shared-axis-z | static | [0.0036, 0.0036] | 0.0 |
| sheet-spring-up | adapter-errors | [0.063, 0.063] | 0.0 |
| shimmer-sweep | adapter-errors | [0.0, 0.0] | 0.0 |
| shutter-slam | renders-and-animates | [0.0606, 0.0606] | 0.0042 |
| signup-flow | static | [0.0806, 0.0806] | 0.0 |
| skeleton-reveal | static | [0.0131, 0.0131] | 0.0 |
| slit-scan-reveal | renders-and-animates | [0.0441, 0.0452] | 0.0893 |
| slot-machine-roll | static | [0.0019, 0.0019] | 0.0 |
| social-proof-card | renders-and-animates | [1.0, 1.0] | 0.0585 |
| soft-blob-touch | renders-and-animates | [0.1494, 0.1461] | 0.0959 |
| soft-blur-in | adapter-errors | [0.0, 0.0] | 0.0 |
| split-tilt-cards | renders-and-animates | [0.9989, 0.9989, 0.9989] | 0.0316 |
| spotlight-card | static | [0.1564, 0.1564] | 0.0 |
| spring-pop | renders-and-animates | [0.1583, 0.1568] | 0.0066 |
| spring-stack-shuffle | renders-and-animates | [0.298, 0.2515] | 0.0226 |
| stagger-cascade | renders-and-animates | [0.984, 0.9815] | 0.0184 |
| stagger-lattice | static | [0.1476, 0.1476] | 0.0 |
| staggered-fade-up | static | [0.0054, 0.0054] | 0.0 |
| star-rating-fill | blank | [0.0, 0.0] | 0.0 |
| state-chip-rail | renders-and-animates | [0.0252, 0.0193] | 0.0328 |
| sticky-mock-swap | renders-and-animates | [0.3435, 0.3424] | 0.0164 |
| stitched-text-draw | renders-and-animates | [0.0043, 0.0161] | 0.0124 |
| stop-motion-cadence | renders-and-animates | [0.0143, 0.0351] | 0.0409 |
| store-badge-lockup | renders-and-animates | [0.1781, 0.1782] | 0.0051 |
| streaming-text | adapter-errors | [0.0, 0.0] | 0.0 |
| strikethrough-replace | static | [0.003, 0.003] | 0.0 |
| success-check | adapter-errors | [0.0028, 0.0028] | 0.0 |
| svg-line-draw-loader | static | [0.1476, 0.1476] | 0.0 |
| svg-mask-reveal | static | [1.0, 1.0] | 0.0 |
| svg-stroke-trace | renders-and-animates | [0.015, 0.036, 0.0355] | 0.0266 |
| swipe-rail | renders-and-animates | [0.9997, 0.9992] | 0.2854 |
| tabs-slide-indicator | static | [0.0061, 0.0061] | 0.0 |
| telemetry-hud | renders-and-animates | [0.9985, 0.9983, 0.9983] | 0.0034 |
| terminal-simulator | static | [0.1712, 0.1712] | 0.0 |
| testimonial-card | renders-and-animates | [0.2878, 0.2878] | 0.006 |
| testimonial-proof-card | renders-and-animates | [0.4033, 0.4032, 0.4032] | 0.01 |
| text-match-cut | renders-and-animates | [0.0453, 0.0274, 0.0261] | 0.0466 |
| text-shimmer | renders-and-animates | [0.0299, 0.0298, 0.0299] | 0.008 |
| text-stagger | adapter-errors | [0.0131, 0.0131] | 0.0 |
| text-state-swap | adapter-errors | [0.0009, 0.0009] | 0.0 |
| texture-mask-text | adapter-errors | [0.0, 0.0] | 0.0 |
| three-orbiting-cards | static | [0.0081, 0.0081] | 0.0 |
| ticker-takeover | renders-and-animates | [0.1379, 0.1379, 0.0249] | 0.1628 |
| tilt-card | static | [0.0543, 0.0543] | 0.0 |
| titlecard-calm | renders-and-animates | [0.044, 0.0439] | 0.027 |
| titlecard-lockup | renders-and-animates | [0.054, 0.0608] | 0.0068 |
| toggle-flip | static | [1.0, 1.0] | 0.0 |
| top-down-letters | static | [0.0053, 0.0053] | 0.0 |
| torn-paper-rip | renders-and-animates | [0.9992, 0.9999, 0.9999] | 0.3228 |
| touch-indicator | blank | [0.0, 0.0] | 0.0 |
| tracing-beam | renders-and-animates | [0.1697, 0.1626, 0.1728] | 0.1267 |
| tracking-in | adapter-errors | [0.0, 0.0] | 0.0 |
| trust-strip | renders-and-animates | [0.0054, 0.007, 0.007] | 0.003 |
| type-match-cut | renders-and-animates | [0.0714, 0.9541] | 0.8482 |
| typed-prompt | renders-and-animates | [0.1515, 0.1483] | 0.0217 |
| typewriter | static | [0.0033, 0.0033] | 0.0 |
| typing-indicator | adapter-errors | [0.0037, 0.0037] | 0.0 |
| ui-focus-zoom | renders-and-animates | [0.9202, 0.8931, 0.8932] | 0.5389 |
| variable-axis-type | renders-and-animates | [0.994, 0.9929, 0.9925] | 0.0413 |
| variable-font-flex | renders-and-animates | [0.022, 0.0205, 0.0205] | 0.0074 |
| vector-editor-rig | renders-and-animates | [1.0, 1.0, 1.0] | 0.0017 |
| velocity-throw-snap | renders-and-animates | [0.8597, 0.8684] | 0.6377 |
| vignette | adapter-errors | [0.0, 0.0] | 0.0 |
| vox-annotate | renders-and-animates | [0.0334, 0.046] | 0.0142 |
| whip-pan-cut | renders-and-animates | [1.0, 1.0, 1.0] | 0.6612 |
| whiteboard-ink | renders-and-animates | [1.0, 1.0] | 0.007 |
| wordmark-tiles | renders-and-animates | [0.4152, 0.4152, 0.4152] | 0.2565 |
| x-follow-card | adapter-errors | [0.1115, 0.1115] | 0.0 |
| yt-camera-move | renders-and-animates | [1.0, 1.0] | 0.0596 |
| yt-circle-pointer | static | [1.0, 1.0] | 0.0002 |
| yt-feather-highlight | renders-and-animates | [1.0, 1.0] | 0.1668 |
| yt-screen-warp | static | [0.4073, 0.407] | 0.0 |
| zoom-through-transition | renders-and-animates | [1.0, 1.0, 1.0] | 0.9458 |

## Starter projects (9)

| Project | Compositions | Video/audio elements | WebGL | Status |
|---|---|---|---|---|
| decision-tree | 1 nested | no | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| kinetic-type | 1 nested | yes | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| nyt-graph | 1 nested | no | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| path-traced-3d | 0 nested | no | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| play-mode | 3 nested | yes | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| product-promo | 3 nested | no | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| swiss-grid | 3 nested | yes | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| vignelli | 2 nested | yes | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
| warm-grain | 3 nested | yes | no | not enabled: needs nested-composition loader + pinned multi-file import; not tested |
