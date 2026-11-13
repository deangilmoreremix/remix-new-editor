# Stage 5 report: Seriously.js effects

Upstream: https://github.com/brianchirls/Seriously.js, commit `513d2b8696b76fe764b3033aa6dc7c99005acccd` (repo licence MIT, per-effect headers checked by reading the file heads). Used as a reference collection; nothing from the Seriously runtime is used. Notice: `src/openchatcut/gl/fx/s35/THIRD_PARTY_NOTICE.md`. Shared registry/tests/harness: see `docs/stage-3/STAGE_3_REPORT.md`.

## Decision per Seriously effect
| Effect | Decision | Reason |
|---|---|---|
| exposure | **vendored (MIT)** `effects/seriously.exposure.js` -> `builtin:fx-exposure` | header has no third-party note. Alpha kept, clamped |
| emboss | **vendored (MIT)** -> `builtin:fx-emboss` | taps computed in the fragment shader; added blend + offset |
| scanlines | **vendored (MIT)** -> `builtin:fx-scanlines` | fixed upstream bug (`width` uniform never bound; uses `u_size`) |
| polar | **vendored (MIT)** -> `builtin:fx-polar` | added `amount` mix and clamping |
| nightvision | independent implementation `builtin:fx-nightvision` | upstream says "based on tutorial" (geeks3d, no licence); upstream body not used |
| sketch | independent implementation `builtin:fx-sketch` | upstream "inspired by" a Pixel Bender post |
| ripple | independent implementation `builtin:fx-ripple` | upstream cites an MSDN XNA page |
| vignette, kaleidoscope, pixelate, luma key, chroma, film grain/noise, mirror, invert, sepia, edge | skipped: already in the registry (noise = existing film-grain; edge detect is in Stage 3) | no duplicates |
| displacement | skipped | needs a second image input; the runtime has one `u_input` |
| whitebalance | skipped | auto mode needs readback; manual mode is covered by temperature-tint; upstream cites GPL ikaros as an algorithm source |
| blur, directionblur, bleach-bypass, opticalflow | **not used** (CC BY-NC-SA 3.0) | box/radial/motion blur were written independently |
| filmgrain | not used (CC BY 3.0) | existing film-grain effect kept |
| lut, blend | not used | no licence text / credit TODO; existing LUT + blend implementations kept |
| tvglitch, freeze, accumulator, throttle, expression | skipped | multi-pass / runtime logic |
| vibrance / temperature / hex (glfx or third-party refs) | not copied | vibrance and temperature-tint re-implemented originally (Stage 3) |

## Status of the 7 Stage 5 effects
All 7 done: params with defaults/ranges, inspector sliders and keyframes via the existing effects section, saved in `Clip.fx[]`, applied in preview and export through `ALL_FX`, WebGL2-missing fallback = effect skipped + one warning.
| Effect | Params | Neutral setting |
|---|---|---|
| exposure | exposure stops -4..4 (default 0.5) | 0 |
| emboss | amount, offset px, blend original | blend 1 |
| scanlines | lines, thickness, intensity | intensity 0 |
| polar | angle, amount | amount 0 |
| nightvision (animated) | amplification, threshold, noise, goggle vignette | none (always stylised) |
| sketch | line strength, hatching, colour mix, hatch scale | none |
| ripple (animated) | centre, frequency, amplitude, speed, falloff | amplitude 0 |

## Verification
Same harness and results as Stage 3 (`node docs/stage-3/smoke/fx-gl-check.cjs`: 21/21 pass in headless Chromium/SwiftShader, covering these 7: compile, probe differs, neutral ~ identity where defined, deterministic, animated ones change with time). Vitest `occ-stage35-fx.test.ts` also asserts: vendored shader headers contain repo, file, commit, MIT and the author; the notice lists each file and commit; the banned Seriously effects are never referenced; no NC-SA/CC-BY text appears in any shader.

## Limits
Shader-level and function-level only: no real exported frame was rendered through the web renderer. The MIT texts were read from `Seriously.js/LICENSE` (only the copyright line re-checked at the end; the standard MIT body in the notice was typed from the standard text, not diffed against the file).
