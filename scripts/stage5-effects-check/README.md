# Stage 5 — footage look, camera motion, fades, text effects: real-browser acceptance check

`node scripts/stage5-effects-check/check.mjs` (≈ 2.5 min; needs ffmpeg). Builds flat-colour and split fixtures, exports through the app's own exporter in headless Chromium, decodes the MP4 frames with ffmpeg and compares them with:

* the colour model's prediction (`predictLookRgb`) for every preset and each control, on four colour bands (the predictor is fed the colours the same export produces for the untouched clip, because the browser's H.264 colour handling shifts nominal fixture colours);
* where the picture's edge must be at each frame under zoom and drift;
* black frames / half-bright frames for fades;
* the same text with and without glow, outline and shadow (halo pixels, blue edge, darker area; the glyph itself untouched);
* exits (fade, slide up) and the new entrances (zoom in, bounce, blur in), and that the original fade entrance is unchanged;
* the presenter bubble's shadow;
* the real editor: panel → Player → export of the same settings (Player frame vs exported frame).

`out/` is git-ignored.
