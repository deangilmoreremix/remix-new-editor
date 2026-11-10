# PoC: HyperFrames-style compositions rendered by Remotion's in-browser renderer

Isolated and dev-only. Not a workspace member, not imported by the app, no effect on `npm run build`.

## Run
```bash
cd poc/hyperframes-remotion
npm install --ignore-workspace
npx vite --port 3199                      # terminal 1
node run-poc.mjs                          # terminal 2 (set PLAYWRIGHT_PATH if `playwright` is not resolvable)
```
Test footage is generated first: `ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30:duration=4 -c:v libx264 -g 30 -pix_fmt yuv420p public/footage.mp4`.
Writes `out/<name>.mp4` and `out/<name>-f<frame>.png`.

## How it works (Method B, no iframe)
`src/HyperFramesClip.jsx` mounts a HyperFrames-contract composition (markup with `data-*` attributes plus its own
GSAP script that registers `window.__timelines[id]`) directly in the React tree. On every Remotion frame it seeks
that timeline to `frame / fps`. Because the DOM is in the tree, `@remotion/web-renderer` can capture it with
no server, Node, Chromium or FFmpeg on the customer's side.

## Results (Chromium headless, @remotion/web-renderer 4.0.540, 1280x720@30, 4 s, H.264 MP4)
| Test | Result | Render time | Fidelity |
|---|---|---|---|
| 1. GSAP lower third (text, panel, eases) | PASS | ~3.4 s | MP4 vs still SSIM 0.993 |
| 2. Transparent GSAP overlay over real MP4 footage | PASS, footage frame-exact (frames 20/45/90 match) | ~5.7 s | SSIM 0.81-0.88: H.264 recompression of a fine test pattern, not a sync error |
| 3. WebGL shader driven by the timeline | PASS after fix | ~3.7 s | SSIM 0.97-0.99 |

## Findings
- **Must seek WITH events.** `@remotion/gsap`'s `useGsapTimeline` forbids timeline callbacks, and a seek with
  `suppressEvents=true` blocked the `onUpdate` that redraws canvas/WebGL, so the shader stayed frozen at frame 0.
  Native HyperFrames scripts use callbacks, so the adapter resets silently and then seeks with events.
- **Iframe/player embedding was not used.** Remotion's web renderer does not capture arbitrary iframe content (Method A, not run).
- **WebGL needs `preserveDrawingBuffer: true`** so the canvas can be read back.
- **Not covered yet:** Firefox/Safari, 1080p, HyperFrames audio tracks, `<video>` elements inside compositions, real
  registry blocks (only hand-written contract-style compositions were tested), SSIM against the HyperFrames CLI render.

## Catalog blocks (in progress)
`src/BlockClip.jsx` runs unmodified HyperFrames registry blocks; `setup-blocks.mjs` installs them, `run-blocks.mjs` renders stills, `compare.py` scores them against native `hyperframes snapshot` frames.
- PARTIALLY VERIFIED: 3 blocks run so far (code-diff 0.966-0.969, bar-chart-race ~0.98, camcorder-hud ~0.97 SSIM vs native). code-diff lacks the thin left border bar on diff lines.
- A 0.71 SSIM seen earlier was a harness artifact (GPU flag combination made blurred layers transparent), not an adapter fault. Runner now uses default Chromium flags.
- Must use `useDelayRender()` (not the standalone `delayRender`) or the web renderer unmounts the component before async mounts finish.
- NOT TESTED: the other 207 blocks, 1080p, audio/video inside blocks, Firefox/Safari, SDK, Player, sandboxing. The adapter still uses `eval`/`innerHTML` and is dev-only; it must not run customer content.
