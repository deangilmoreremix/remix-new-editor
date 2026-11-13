# Stage 6 report: GL Transitions

Branch `claude/focused-brown-9xfv3c-stage6`. Upstream: gl-transitions `d2f250e5cee85d9cfb225b584aeabecfbf8dea42` (read as untrusted text, never executed).

## 1. Audit of what existed (no duplicates added)

| Piece | What it is | Reaches export? |
|---|---|---|
| `src/openchatcut/gl/transitions.ts` | 16 hand-written GLSL ES 3.00 transitions (`cross-dissolve`, `dip-to-black`, `flash`, `luma-blend`, `soft-wipe`, `whip-pan`, `page-curl`, `rack-focus`, `organic-dissolve`, `impact-shake`, `anticipation-zoom`, `clean-line-wipe`, `circle-wipe`, `radial-blur`, `glitch-cut`, `dip-to-color`) | Yes (CineGen path), via `GlTransitionLayer` + own WebGL2 runtime |
| CineGen cut transition (`Transition.glType`, `occ/transitions.ts`, `clip-transition-section.tsx`) | Picker was a `<select>`; no parameters | Yes: `export-tab` -> `exportTransitionsFromTimeline` -> `web-api.ts` `glTransitions` -> `TimelineComposition` -> `GlTransitionLayer` |
| `src/lib/editor/remotion/transitionMap.js` (classic) | ~35 classic gl-transitions v1 names mapped to `@remotion/transitions` presentations; the "gpu" ones (`crosswarp`, `ripple`, `cube`...) use Remotion's `HtmlInCanvas` and **fall back to CSS fade/slide/wipe in export** | CSS fallback only |
| `src/lib/editor/addons/glTransitionRenderer.js` (classic) | `gl-transitions@1.43` (125 names) for the classic **preview** only | Preview only |

Duplicates deliberately **not** vendored: `Fade` (= cross-dissolve), `FadeColor` / `FadeGrayscale` (= dip-to-color), `WhipPan` (= whip-pan), `InvertedPageCurl` (= page-curl; also the BSD-3 one). `LumaWipe` and `DisplacementMap` need an extra texture and are excluded (reason recorded per shader in `upstream-index.generated.json`).

## 2. Spike: does `@gl-transitions/remotion` work in `renderMediaOnWeb`?

**No. Decision: do not add the adapter; vendor individual shaders into the existing GL path.** Evidence:

1. `@gl-transitions/remotion@2.0.0` is `makeHtmlInCanvasPresentation(shader)` from `@remotion/transitions` (installed 4.0.540). Reading `node_modules/@remotion/transitions/dist/html-in-canvas-presentation.js`: it captures the scenes with `canvas.captureElementImage(firstChild)` and `ctx.drawElementImage(...)`, i.e. the Chrome **HTML-in-canvas** API. `remotion/dist/cjs/HtmlInCanvas.js` gates it on `drawElementImage` + `requestPaint` + `captureElementImage` all being functions.
2. Real Chromium probe (`docs/stage-6/smoke/adapter-capability-probe.cjs`, Chromium 153 as installed here): with **no flags** `drawElementImage`, `requestPaint`, `captureElementImage` are all `undefined`; only with `--enable-features=CanvasDrawElement --enable-blink-features=CanvasDrawElement` do they appear. WebGL2 and OffscreenCanvas WebGL2 are available. Requiring an experimental flag for a normal export flow is out of scope; `@remotion/web-renderer/dist/html-in-canvas.d.ts` also documents a nested-capture path needing a newer Chrome (157 in `remotion/HtmlInCanvas.js`).
3. The existing path already burns GL into frames without that API: `GlTransitionLayer` draws both clips' video frames (`onVideoFrame`) into 2D stage canvases, runs the shader with its own `createGlRuntime` WebGL2 context and mirrors the result into a plain canvas that `renderMediaOnWeb` rasterises. The 16 built-ins export through it today.
4. Also: the adapter needs `gl-transitions ^3` while the repo pins `^1.43` (classic preview), and it reads shaders from the npm package at runtime (no per-shader curation or notice).

So: shaders from the upstream checkout are vendored (verbatim files) and wrapped to this runtime's contract (`src/openchatcut/gl/glt/buildFrag.ts`). No new npm dependency was added.

## 3. Catalog + vendored set

- `scripts/lib/glt-parse.mjs` (pure parser: Author, License, Description, Tags, `uniform` params with `// = default`, `@range`, `@color`, `@param`) and `scripts/gen-gl-transitions-catalog.mjs <checkout> [--out dir]` generate, deterministically (no timestamps):
  - `src/openchatcut/gl/glt/catalog.generated.ts`: the 77 vendored shaders (id `glt-<kebab>`, category, author, licence, description, tags, typed params + defaults + ranges, **verbatim upstream file text including its licence header**),
  - `src/openchatcut/gl/glt/upstream-index.generated.json`: all 220 upstream shaders with author/licence/`vendored`/`excluded` reason,
  - `src/openchatcut/gl/glt/THIRD_PARTY.md`: upstream commit, repo MIT licence text, one row per vendored shader with author and licence.
- Curated list lives in `scripts/lib/glt-curated.mjs`. 77 shaders, **all MIT** (the BSD-2/BSD-3 ones were not needed for coverage and were left out; the notice generator handles them if added). Authors: gre (43) plus 20-odd others, as printed in THIRD_PARTY.md.
- Runtime adaptation (`buildFrag.ts`): GLSL ES 1.00 wrapper (the runtime pairs a fragment without `#version 300 es` with its ES 1.00 vertex shader): `u_outgoing`/`u_incoming` samplers, `v_texCoord`, `#define progress u_progress`, `#define ratio u_aspect`, `getFromColor/getToColor`, `main() { gl_FragColor = transition(v_texCoord); }`. `runtime.ts` got an additive `setUniform` change so `int` / `bool` / `ivec2` uniforms use `uniform1i/2i` (looked up once per program via `getActiveUniform`); the previous float path is unchanged.

Vendored (77):
- 3D (12): BookFlip, CardSwipe, Cube, CylinderRoll, Doorway, FallOver, Fold, InsideCube, PaperFold, Revolve, Rolls, SimpleFlip
- Blur & Zoom (7): CrossZoom, DefocusBlur, Funnel, SimpleZoom, SimpleZoomOut, Squeeze, TangentMotionBlur
- Dissolve & Pixel (8): CellDissolve, DitherDissolve, Hexagonalize, Mosaic, PerlinDissolve, Pixelize, RandomSquares, SquaresWipe
- Distortion (13): CrossWarp, Fisheye, GravityLens, HeatHaze, Kaleidoscope, Morph, Prisms, Refraction, Ripple, Swirl, Vortex, WaterDrop, Wind
- Glitch & Retro (6): GlitchBands, GlitchDisplace, GlitchMemories, TvLostSignal, TvStatic, VhsTracking
- Light & Color (5): ColorPhase, DuotoneFade, FilmBurn, LensFlare, LightRays
- Slide (5): Directional, DirectionalWarp, Slides, SplitSlideInHorizontal, WindowSlices
- Wipe (21): ApertureWipe, ArrowWipe, BandWipe, CircleOpen, ClockWipe, Curtains, CurvedWipe, DirectionalWipe, HeartWipe, HorizontalOpen, LeafWipe, PlusWipe, RadialWipe, RingsWipe, ShutterWipe, SpiralWipe, SpotlightWipe, StarWipe, WaveWipe, WedgeWipe, WindowBlinds

## 4. Picker UI, parameters, persistence, export

- `src/cinegen/components/edit/transition-picker.tsx`: `TransitionPicker` (search box, category chips All / Classic / the 8 categories, grid of cards with the existing `TransitionThumb` preview still and live hover/focus preview) and `TransitionParams` (float/int sliders from `@range` or a default-derived range, bool checkbox, colour input for `@color` vec3/vec4, 4-way Direction select for `vec2 direction`, numeric inputs for other vec/ivec, "Reset parameters"). Only changed values are stored. Used in `clip-transition-section.tsx` for both "add" and "edit existing"; a "Plain dissolve" button keeps the old plain option. Library panel and library modal also list the `glt-*` cards (drag/click path unchanged).
- Duration: chosen with the existing Length slider when the transition is added (CineGen's duration defines the clip overlap, so it is not editable afterwards; unchanged behaviour).
- Project format: `Transition.glParams?: Record<string, number | boolean | number[]>`; DB rows get `gl_params_json` (same pattern as Stage 1's `stage1_json`); JSON projects keep it as an unknown-but-preserved field. Old rows without it load unchanged.
- Preview: `activeGlTransition` -> `gl-clip-layer` -> `resolveTransition(glType, glDef, glParams)`.
- Export: `ExportTransitionInfo.glParams`; the GL-layer mapping that was inline in `web-api.ts` is now the pure `buildGlTransitionLayers` (`src/cinegen/lib/editor/gl-transition-export.ts`), `TimelineComposition` passes `glParams` to `GlTransitionLayer`, which resolves `glt-*` by id (no shader snapshot is shipped to the runner; the shader is bundled in it).

## 5. Verification actually run

| Check | Result |
|---|---|
| Manifest determinism: generator run twice from the upstream checkout, byte-identical, and equal to the committed files; licence/author completeness for all 77 + index of all 220; THIRD_PARTY covers every shader | vitest `src/openchatcut/gl/glt/__tests__/catalog.test.ts` (12 tests, pass). The determinism test skips if the upstream checkout is absent (`GLT_UPSTREAM`) |
| Shader compile + render in real headless Chromium WebGL2 (SwiftShader) through the real `runtime.ts`, progress 0 / 0.5 / 1: all 77 compile and link; progress 0 equals the outgoing image and progress 1 the incoming image within mean abs error 4/255 per channel (observed 0.0 for all but TangentMotionBlur 1.7 and RadialWipe 0.2), progress 0.5 differs from both | vitest `glt-webgl.test.ts` (2 tests, pass, ~9 s); also overrides of int / ivec2 / float / vec2 uniforms change the frame |
| Project save -> load round trip (real `transitionToRow` / `timelineFromRows`, JSON path, legacy row without the column) | `stage6-transitions.test.ts` pass |
| Export mapping (real `exportTransitionsFromTimeline`, real `buildGlTransitionLayers`, real `timelineToComposition`, structured clone as sent to the runner) | `stage6-transitions.test.ts` pass |
| Picker UI behaviours (counts, category, search, pick, hover, params, reset, direction, bool, colour, int/ivec2) | `src/cinegen/__tests__/transition-picker.test.tsx` (jsdom; only the WebGL thumbnail component is mocked) |
| **Real export** through `renderMediaOnWeb` | `docs/stage-6/smoke/stage6-export-smoke.cjs`: the real export model (`stage6-export-model.smoke.test.ts` builds it with the real chain) is posted to the real export runner page (`/export-runner.html`, `src/export-runner/main.jsx`) in headless Chromium 153, no flags, VP9/WebM output (this Chromium build has no H.264 encoder; the runner picks the codec from `options`). Mid-transition frames (t = 2.5 s of the rendered file, decoded with ffmpeg) show a hard wipe edge: with `direction [1,0]` the left column is clip B and the right column still clip A; with `[0,1]` the bottom row is B and the top row A (a cross-fade would be uniform purple), t = 1.0 s is A and t = 4.2 s is B. 8/8 assertions pass; renders took 17-36 s for 150 frames at 1280x720. Sample frames: `docs/stage-6/smoke/mid-transition-wipe-right.jpg`, `mid-transition-wipe-up.jpg` |
| Lint | `eslint --quiet` on all changed/new files: 0 errors (warnings in untouched code only). Needs `NODE_OPTIONS=--max-old-space-size=8192` (the 240 KB generated file carries `/* eslint-disable */`) |

Test counts: `npx vitest run src/cinegen src/openchatcut src/lib/editor src/export-runner`: 298 files passed, 2427 tests passed, 30 skipped, 1 failed. The one failure is the pre-existing `timeline-parity.test.ts` line budget for `timeline-editor.tsx` (fails identically with this work stashed). `help-coverage.test.ts` initially caught the picker's two new labels; help entries were added (`help-content.ts`) and it passes. New tests: 12 (catalog) + 2 (WebGL) + 6 (stage6-transitions) + 3 (picker) + 3 (export-model builder, env-gated) = 23 added.

## 6. Status per item

1. Audit: done (section 1).
2. Spike: done with evidence; adapter rejected (section 2).
3. Catalog + vendoring + notices: done, 77 shaders (target 40-80).
4. Picker (categories, search, thumbnails), parameter controls, save/load, export burn: done and verified as above. Not verified: the picker inside the full running app (needs a signed-in project in a browser); it is verified at component level plus the export path in a real browser.
5. Classic-editor-to-export fallback: **not done, documented.** It could be wired without touching `TimelineEditorPage.jsx` (map classic names such as `crosswarp`/`cube`/`ripple` to `glt-*` ids in `timelineToComposition.js` and emit `glTransitions` entries), but the GL layer samples the raw video frames and sits above every other layer, so for classic clips with effects/transform/zoom/keyframes or overlays above the cut it would drop those during the transition window. That is a regression compared to today's CSS presentation, so it needs a compositing decision (render the paired layers into the GL sources) before wiring. Plan: a `gltClassicMap` + restriction to plain clips, or layer-aware sources.

## 7. Files

New: `scripts/gen-gl-transitions-catalog.mjs`, `scripts/lib/{glt-parse,glt-curated,glt-webgl-check}.mjs`, `src/openchatcut/gl/glt/{index,buildFrag,paramUi}.ts`, `src/openchatcut/gl/glt/{catalog.generated.ts,upstream-index.generated.json,THIRD_PARTY.md}`, `src/openchatcut/gl/glt/__tests__/{catalog.test.ts,glt-webgl.test.ts,harness/entry.ts}`, `src/cinegen/components/edit/transition-picker.tsx`, `src/cinegen/lib/editor/gl-transition-export.ts`, `src/cinegen/__tests__/{transition-picker.test.tsx,editor/stage6-transitions.test.ts,editor/stage6-export-model.smoke.test.ts}`, `docs/stage-6/*`.

Modified (small, additive): `src/cinegen/types/timeline.ts` (`glParams`), `src/cinegen/lib/db-converters.ts` (`gl_params_json`), `src/cinegen/lib/editor/export-mapping.ts`, `src/cinegen/adapters/web-api.ts` (inline mapping replaced by `buildGlTransitionLayers`), `src/cinegen/lib/occ/{transitions,plugins}.ts`, `src/cinegen/lib/help/help-content.ts` (2 help entries), `src/cinegen/components/edit/{clip-transition-section,gl-clip-layer,library-panel,occ-library-modal}.tsx`, `src/lib/editor/remotion/TimelineComposition.jsx` (one prop), `src/openchatcut/gl/{runtime,GlTransitionLayer,transitionThumb}.ts(x)`, `src/openchatcut/library/TransitionThumb.tsx`. `edit-tab.tsx`, `export-tab.tsx`, `TimelineEditorPage.jsx` untouched.

## 8. Limitations

- Direction is one fixed mapping (left `[-1,0]`, right `[1,0]`, up `[0,1]`, down `[0,-1]`) onto the shader's `direction` vector; what "left" means visually differs per shader (only `Directional*` and similar have the param). Only DirectionalWipe was checked in the export.
- Only video sources are supported by the GL layer (existing limitation: image clips on a GL cut are not sampled).
- The GL layer replaces everything under it during the window (existing CineGen behaviour, unchanged).
- Bundle: the catalog adds ~240 KB source (~60-80 KB gzip) to whatever chunk imports `GlTransitionLayer`/the picker; it is statically imported because the export runner needs it. Lazy-loading is possible later.
- Copilot (`copilot-look-ops.ts`) still picks only from the 16 built-ins; the vendored ones are reachable from the picker/library only.
- Thumbnails/previews use the sample A/B frames; shaders with time-based looks have no time uniform (upstream has none).
- Endpoint test tolerance of 4/255 is for the synthetic gradient test images; real footage differs slightly for blur-based shaders at the endpoints only through bilinear taps.
