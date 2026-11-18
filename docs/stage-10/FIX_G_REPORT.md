# Fix G report: Pixel Sort (the one Stage 3 effect that was missing)

Branch `claude/focused-brown-9xfv3c-fixG` (worktree `/home/user/wt-fixG`). Everything below was run in this session; the limits section says what was not.

## What was built

`builtin:fx-pixel-sort` ("Pixel Sort"), a deterministic WebGL2 multi-pass fragment-shader effect (GLSL ES 3.00, no compute). Files: `src/openchatcut/gl/fx/s10/{pixel-sort-prep,pixel-sort-step,pixel-sort-mix}.frag`, `s10/pixelSort.ts` (FxDef + pass graph), `s10/pixelSortRef.ts` (CPU reference of the same algorithm), registered in `shaderEffects.ts`.

**Algorithm (independent; FreeCut's WGSL compute pixel-sort was read only as an idea and nothing was copied, attribution is in the shader header and `s35/THIRD_PARTY_NOTICE.md`).** Odd-even transposition sort over ping-pong fragment passes. Each pass, every pixel looks at exactly one neighbour along the axis (pairs `(s, s+1)` with `(s + pass)` even). A pair is compared only if both pixels are in the mask (sort key within `[low, high]`, or outside when inverted, and alpha > 0); if the keys are out of order the two pixels swap. Because swaps only happen between masked pixels, a pixel's mask status never changes, so no mask texture is needed and unmasked pixels are never written. Passes: 1 copy (to canvas size, also the "original"), `length` sort steps, plus 1 mix pass only when strength < 1.

| Param | Key | Range (default) |
|---|---|---|
| Threshold low / high | `low`, `high` | 0..1 (0.25 / 0.85), window on the key |
| Sort key | `key` | 0 luma, 1 hue, 2 saturation, 3 brightness (0) |
| Axis | `axis` | 0 horizontal rows, 1 vertical columns (0) |
| Ascending | `ascending` | 1 / 0 (1) |
| Length | `length` | 0..64 passes (32) |
| Strength | `strength` | 0..1 mix with the original (1) |
| Invert mask | `invert` | 0 / 1 (0) |

All eight are number props, so all are keyframeable from the inspector diamond (stored in `Clip.anim` `fx:<i>:<prop>`; the pass count changes per frame with an animated `length`). Persistence is `Clip.fx[].props`. Preview (`gl-clip-layer.tsx`) and Remotion web-renderer export (`ClipFx.tsx`) resolve `ALL_FX` by id, so no further wiring; the WebGL2-unavailable fallback (skip + one `console.warn`) is the existing one.

**Cost (documented in `pixelSort.ts`).** `passes = 1 + length (+1)`; each sort step is one full-frame draw with 2 `texelFetch` and 2 key evaluations per pixel. At 1920x1080 and `length` 64: 65 passes, about 135 M pixel-shader invocations per frame. Measured here on software GL (SwiftShader) at 257x151, 64 passes: 53 ms (`fixg-gl-results.json`).
**Semantics, stated plainly.** One step moves a pixel at most 1 place, so `length` is the maximum travel distance. A masked run of L pixels is fully sorted only if `length >= L`; longer runs are partly sorted (streaks). Arbitrary sort angles are **not** implemented (only horizontal / vertical).

**Small additive core change: `FxPass.slot`** (`runtimeTypes.ts`, `runtime.ts` in `renderFxChain` and `renderFxPassesToTexture`, `uniforms.ts` `fxPasses` rebases it). The runtime kept one full-size FBO per pass index, which for 66 passes at 1080p would be about 530 MB. `slot` lets a pass choose its FBO; pixel sort ping-pongs over 3 slots (copy, A, B) regardless of `length`. Default (no `slot`) behaviour is unchanged; the Stage 3/5 and Fix C browser smokes were re-run after the change and still pass (21/21 and ALL PASS).

## Verification actually run

- **Shader level, headless Chromium (SwiftShader WebGL2)**: `node docs/stage-10/smoke/fixg-gl-check.cjs`, 257x151 (odd, non-square) gradient + seeded noise image, **ALL PASS** (output `docs/stage-10/smoke/fixg-gl-results.json`): compiles/links/renders at defaults (33 passes); identity (max abs diff 0) for `length 0` (1 pass), empty window `low 1 / high 0` (also with length 64), `strength 0`; four parameter sets (horizontal luma asc, vertical hue desc with inverted mask, horizontal saturation asc, vertical brightness asc), each: unmasked pixels bit-identical to the input, every line is a permutation of the input line, every masked run with length <= passes is monotone in the key (1820 / 1820, 1708 / 1708, 134 / 134, 2186 / 2186 runs), GPU equals the CPU reference (0 px differ in the final run); deterministic on the same runtime (with another render in between) and on a fresh runtime; strength 0.5 equals the mean of original and sorted within 0.5 level; chains `[pixel sort, invert]` and `[invert, pixel sort]` correct (slot rebase); all 16 min / max prop renders succeed.
  *Honest note:* my first run had 98 / 60 px GPU-vs-CPU mismatches for hue / saturation. Cause: thresholds I had picked (0.2, 0.6, 0.1) coincide exactly with key values of 8-bit colours, where float32 (GPU) and float64 (CPU) comparisons can differ. I moved those test thresholds to 0.2013 / 0.6007 / 0.1013 (no shader change). Consequence: a pixel whose key lies exactly on a threshold may be treated differently on different GPUs; deterministic on a given one.
- **Vitest** `src/cinegen/__tests__/fixg-pixel-sort.test.ts` (17 tests): registry and schema, clamping, shaders are GLSL 300 es / no WGSL / FreeCut attribution, help entry, pass graph (identity = 1 pass, `1 + length (+1)`, cap 64, parity alternates, at most 3 slots, never reading its own slot, slot rebase when chained), CPU reference semantics (asc / desc, window, invert, travel bounded by length, vertical, odd sizes, alpha, keys, determinism), JSON persistence, `Clip.anim` key on `length` changes the pass count, real `exportItem` mapping. Effect-count tests changed 56 -> 57 (`occ-clip-fx.test.ts`, `occ-stage35-fx.test.ts`).
- **`npx vitest run src/cinegen src/openchatcut`**: Test Files 224 passed | 2 skipped; Tests 1744 passed | 32 skipped; 0 failed (run before the smoke-only commits; no source change since).
- **ESLint** on changed source / test files (`NODE_OPTIONS=--max-old-space-size=6000`; the default heap ran out): 0 errors, warnings are the usual `no-unused-vars` on type-signature parameter names. The `.cjs` / `.py` smoke scripts were not linted.
- **Real UI + persistence + real export** `docs/stage-10/smoke/fixg-ui-smoke.cjs` (vite dev server, real `#/timeline`, imported 2.5 s 640x360 mp4, Chromium, Export tab "Draft" = 1280x720 h264): ALL UI PASS in the final runs, with `LEN=24` (default, `evidence/fixg-ui-smoke-len24.log`) and with `LEN=64` (`fixg-ui-smoke-len64.log`). It checks: the inspector lists all eight parameters; defaults change the preview; `length 0` and an empty threshold window equal the unprocessed preview (diff 0.000); sorted look at the chosen length; Length keyframes (at 1 s sorted, at 2 s length 0 equals the plain picture); saved project holds `builtin:fx-pixel-sort` with the props and the Length keys; then a real export, then a **control export of the same clip with the effect disabled** and `fixg-export-analyze.py` on both. Export results (LEN 24 / LEN 64): at 1.0 s, 4.8 % / 10.5 % of pixels differ from the control by more than 30 luma levels, while per-row luma multisets are preserved (row-sorted luma diff 0.31 / 0.52 levels vs about 9.0 for rows shifted by 40), i.e. pixels were only permuted along rows; at 2.0 s (Length keyed to 0) the frame equals the control (0.63 % / 1.50 % moved, mean abs diff 1.57 / 2.71, h264 noise). Frames: `docs/stage-10/evidence/export-sorted-t1.0.png`, `export-control-t1.0.png`, `export-sorted-len64-t1.0.png`.
  The thresholds of the export checks (>2 % moved, <2 % at 2 s) were set after a first run, from the measured values; the first analyzer compared with an ffmpeg decode of the source and was discarded because the web renderer's colour range / frame alignment differ from ffmpeg's (row-sorted diff 16 even with no effect).

## Limits and open items (stated plainly)

- **Unexplained stall**: one earlier export attempt with `length 64` sat at "Rendering 0 %" for 15 minutes (killed by the smoke's timeout). The same configuration then exported in 55 s in the final LEN=64 run. I did not find the cause (the first attempt also had a flickering preview, see next point). Not reproduced, not fixed.
- **Preview under software GL**: in one debugging session at `length 64` the preview canvas flickered between the effect and the plain video (the preview's video element kept re-seeking, `gl-clip-layer` hides the canvas while a video is not ready). It did not reproduce in the final runs. No GL error was involved. Real GPUs were not tried.
- The export check is statistical against a control export (permutation along rows, fraction moved); no per-pixel expected image was computed from the project for the export, because the GL upscale, h264 and frame alignment differ from any CPU model. Per-pixel agreement is checked at shader level only (GPU vs CPU reference, 257x151).
- Only horizontal / vertical axes (no arbitrary angle). Long masked runs are only partly sorted (by design, see semantics). Hue / saturation keys on near-grey pixels are noisy by nature. The mask is per-pixel on the input colour, there is no spatial smoothing of the threshold.
- Preview and export at 1080p with `length` 64 were not run (export checked at 720p); the cost figure for 1080p is arithmetic, not a measurement.
- A pixel exactly on a threshold value may be classified differently on different GPUs (float32); not a determinism problem on one machine.
- Colour props / UI polish: the inspector shows the key and axis as 0..N number sliders (labels spell out the meaning), not drop-downs.
- Not touched: fixE (transitions / compound) and fixF (watch page / SQL) areas, `/home/user/remix-new-editor`.

## Files

New: `src/openchatcut/gl/fx/s10/*` (3 `.frag`, `pixelSort.ts`, `pixelSortRef.ts`), `src/cinegen/__tests__/fixg-pixel-sort.test.ts`, `docs/stage-10/smoke/{fixg-gl-entry.ts,fixg-gl-check.cjs,fixg-gl-results.json,fixg-ui-smoke.cjs,fixg-export-analyze.py}`, `docs/stage-10/evidence/*`, this report.
Modified: `gl/runtime.ts`, `gl/runtimeTypes.ts`, `gl/fx/uniforms.ts` (slot), `gl/fx/shaderEffects.ts` (registration), `gl/fx/s35/THIRD_PARTY_NOTICE.md` (attribution), `lib/help/help-content.ts` (1 entry), `occ-clip-fx.test.ts`, `occ-stage35-fx.test.ts` (count 57).
