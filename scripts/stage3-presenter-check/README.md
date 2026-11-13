# Stage 3 — presenter effects: real-browser acceptance check

`node scripts/stage3-presenter-check/check.mjs` (≈ 6 min; needs internet for the MODNet model and ffmpeg/ffprobe on PATH).

What it does, in headless Chromium against the real code:

* **Bake** the sample presenter clip (`public/media/recast-example/source-performance.mp4`, MIT, with a synthetic soundtrack muxed in because the
  original has none) with the real MediaPipe segmenter through the app's `bakePresenterMatte`; checks the WebM has alpha + audio, frame count,
  coverage, measured person bounds, **reuse** from the cache (no second segmentation), and **restore from IndexedDB** after the in-page registry is
  wiped (a reload).
* **Export** (the app's own `exportPersonalizedVideo`) colour fill, remove-over-a-solid-website, blur, camera bubble and a no-presenter baseline;
  decode the MP4s with ffmpeg and measure silhouette IoU against the baked matte's alpha, person pixels against the SOURCE frame, background purity,
  blur sharpness/brightness, bubble clipping/ring/position, matte-to-timeline sync (when the clip has motion), audio level relative to the baseline
  (not doubled/dropped) and audio alignment (cross-correlation).
* **Engines**: MODNet vs MediaPipe on a head-and-shoulders crop (its intended input) and, as a note, on the full-body cut.
* **Editor**: the real panel (preset → honest "needs processed footage" → Process → footage reference + bounds → frame head and shoulders), a real
  mouse drag of the stage box, then the real preview Player frame vs the exported frame for the same settings.

`spike.mjs` / `spike2.mjs` are the small exploratory runs used while building; `out/` is git-ignored.
