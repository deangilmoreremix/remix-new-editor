# Stage 3 report: effects and colour grading gaps (CineGen)

Branch `claude/focused-brown-9xfv3c-stage35`. Stages 3 and 5 share one registry module, so the effect table covers both; Stage 5 is in `docs/stage-5/STAGE_5_REPORT.md`.

## What already existed (verified in code, not re-added)
CineGen GL registry (`src/openchatcut/gl/fx`): 33 `builtin:fx-*` effects before this work (the audit said 34; `FX_IDS.length` was 33 in `occ-clip-fx.test.ts`) plus 16 LUT/looks. Present before: rect/circle mask, local mosaic, magnify, tilt-shift, CRT, ASCII rain, camera shake, luma key, **chroma key (already has spill suppression)**, **colour wheels (lift/gamma/gain)**, **levels**, highlights/shadows, clarity, HSL qualify, vignette, film grain, RGB split, glitch, bloom, pixelate, posterize, duotone, mirror, fisheye, kaleidoscope, edge glow, soft blur, light leak, sepia, invert, halftone, motion blur. Also present: LUT intensity (`clip.lut.intensity`), blend modes (`lib/occ/blend`), per-property effect keyframes (`ClipFx.keys`), `.cube` import.
Export path (confirmed in code): `exportItem()` -> `occFx` -> `timelineToComposition` -> `TimelineComposition.jsx` -> `ClipFx.tsx`, which resolves `ALL_FX[id]` and burns the GL frame in. Any id registered in `FX_EFFECTS` is therefore applied in both preview (`gl-clip-layer.tsx`) and the Remotion export without further wiring.

## New effects (14 for Stage 3, all original GLSL ES 3.00, not derived from FreeCut WGSL)
| Effect (`builtin:fx-…`) | Status | Params |
|---|---|---|
| curves | done | 5 master points (Catmull-Rom) + R/G/B mid bend |
| gradient-map | done | 3 stops as HSV, mid position, intensity |
| vibrance | done | vibrance, saturation, skin protection |
| temperature-tint | done | temperature, tint, preserve luma |
| sharpen | done | amount, radius, threshold (unsharp mask) |
| radial-blur | done (covers zoom + spin blur) | mode, amount, centre x/y |
| box-blur | done (2-pass separable) | radius |
| twirl | done | centre, radius, angle |
| wave | done (animated) | amplitude, frequency, speed, axis |
| bulge-pinch | done | centre, radius, strength (+/-) |
| glass | done | amount, scale, ribs, drift speed |
| edge-detect | done (Sobel) | strength, threshold, mix original, invert |
| vhs | done (animated) | tracking, chroma bleed, noise, scanlines, fade |
| ascii-text | done (6 original 5x5 glyphs, no font texture) | cell, brightness, colour, invert, mix |
Colour scopes: RGB parade added to `src/lib/editor/colorScopes.js` (`computeScopes().parade`, drawn in the panel); the scopes are now wired into CineGen (`components/edit/color-scopes-panel.tsx`, toggled from the Effects section) and read the preview frame (the GL canvas when the clip has effects, else the visible video). The classic editor already mounted the panel (it also gets the parade).
All props are number props so every parameter can be keyframed from the existing inspector diamond buttons. Colour-kind props were avoided because the inspector does not render them (existing colour-wheels/duotone colours are not editable there either - a pre-existing gap, not changed).

## Not done / skipped (with reason)
- Pixel sort: needs compute / multi-pass sorting; no faithful single-pass GLSL. Skipped.
- Pen-path masks, animated masks, corner-pin handles: touch timeline types, transform and keyframe schemas owned by the Stage 2 worktree; skipped to avoid collisions. Not started.
- Separate pixelate, RGB split, mirror, kaleidoscope, posterize, halftone, CRT, glitch, scanlines (Stage 5): already exist or added in Stage 5; not duplicated. Zoom blur and motion blur are covered by radial-blur / existing motion-blur.
- Spill suppression, levels, colour wheels, blend modes, LUT intensity: already present (see above).

## Fallback without WebGL2
`createGlRuntime` throws `WebGL2 not available`; `ClipFx.tsx` (export + Player) catches it, classifies it `webgl-unavailable`, leaves the source picture and now logs one `console.warn` (`glSupport.warnGlFxSkipped`) instead of an error per frame; `gl-clip-layer.tsx` does the same. Effect is skipped, clip stays visible. Unit-tested (classification, once-only warning); not exercised in a real browser without WebGL2.

## Verification actually run
- `node docs/stage-3/smoke/fx-gl-check.cjs`: bundles the real registry and `createGlRuntime` with esbuild and runs them in headless Chromium (WebGL2 via SwiftShader). For all 21 effects (Stage 3 + 5): compile/link OK; default render, probe (non-default) render, neutral render; asserts probe differs from the input (> 1.0 mean abs level), neutral is identity (<= 1.5; most are exactly 0), output is byte-identical on a second render and on a fresh runtime, animated effects change with time, every prop at its max still renders. Result: 21/21 pass (`docs/stage-3/smoke/fx-gl-results.json`). A contact sheet was inspected by eye once.
- `npx vitest run src/cinegen/__tests__/occ-stage35-fx.test.ts`: 74 tests (registry completeness, schema + uniform wiring, clamping, licence headers/notice, no WGSL / NC-SA text, JSON persistence round trip, keyframes, export mapping through the real `exportItem` + `timelineToComposition`, WebGL fallback helpers). Colour scopes: +2 tests (parade).
- `npx vitest run src/cinegen src/openchatcut src/lib/editor/__tests__/color-scopes.test.js` (note: also includes openchatcut and the scopes test, so not the same set as the quoted baseline): 1 failed, 1514 passed, 27 skipped. The 1 failure is the pre-existing `timeline-parity` `timeline-editor.tsx` budget (224 > 220), identical with my changes stashed.
- eslint on all changed files: 0 errors (warnings are pre-existing, plus none new after fixing one).

## Limits (stated plainly)
- Verification is shader/runtime-level plus function-level export mapping. **No real exported MP4 frame was rendered through `renderMediaOnWeb`** and compared to the preview; not attempted (needs WebCodecs + dev server + media in headless Chromium).
- Test image is synthetic; no per-effect visual golden images are stored.
- `curves` UI is five sliders, not a draggable curve editor.
- The UI was not driven in a browser (inspector list shows the new effects through the existing `FX_IDS` loop; covered by unit tests only).

## Files
New: `src/openchatcut/gl/fx/s35Effects.ts`, `src/openchatcut/gl/fx/s35/*.frag` (22 files), `src/openchatcut/gl/fx/glSupport.ts`, `src/cinegen/components/edit/color-scopes-panel.tsx`, `src/cinegen/__tests__/occ-stage35-fx.test.ts`, `docs/stage-3/smoke/*`.
Modified (small, additive): `shaderEffects.ts` (merge `S35_EFFECTS`), `ClipFx.tsx` (one warning), `gl-clip-layer.tsx` (warning), `clip-effects-section.tsx` (scopes toggle), `colorScopes.js` (+parade), `occ-clip-fx.test.ts` (count 33 -> 54), `color-scopes.test.js`. `edit-tab.tsx` and `export-mapping.ts` were not touched.
