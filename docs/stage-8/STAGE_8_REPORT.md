# Stage 8 report: integration and regression validation (merged Stages 1-7)

Tree: branch `claude/focused-brown-9xfv3c` after the Stage 1-7 merges. Everything below was run in this session against the merged tree unless marked **not verified**.
Browser: the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`, Chromium 153) with SwiftShader WebGL2; vite dev server on :3100. **This Chromium build has an H.264 encoder: the Export tab produced `h264` mp4 files** (the Stage 6 smoke drives the runner directly with VP9/WebM, as before). So the combined export below is H.264/AAC from the real Export tab in this Chromium. Real hardware H.264 on other machines and browsers is not verified.

## 1. Existing browser smokes on the merged tree

| Script | Result | Notes |
|---|---|---|
| `docs/stage-1/smoke/stage1-smoke.cjs` | PASS (15 assertions) | First attempt crashed in the page-open helper (project manager not yet rendered after the cold vite dependency re-optimisation); second run passed. Harness timing, not a product error. |
| `docs/stage-2/smoke/stage2-smoke.cjs` | PASS (11) | |
| `docs/stage-2/smoke/stage2-render.cjs` | PASS (2nd run) | First run in a batch hit "no download within 100 s" while other work ran on the machine; rerun alone rendered, 4.3 MB h264 1920x1080 6 s + aac, saved. Treated as load flake (not reproduced), not merge-caused. |
| `docs/stage-3/smoke/fx-gl-check.cjs` | PASS: 21/21 effects | compile, determinism, probe != input, neutral ~ input |
| `docs/stage-4/smoke/stage4-lib-browser.cjs` | PASS (17) | |
| `docs/stage-4/smoke/stage4-ui-smoke.cjs` | PASS (17) | |
| `docs/stage-6/smoke/stage6-export-smoke.cjs` | PASS (8/8) | media regenerated with ffmpeg per the Stage 6 recipe; port overridden to 3100 |

## 2. Combined end-to-end scenario (`docs/stage-8/smoke/combined-smoke.cjs`, 26/26 assertions pass on the final run)

Real `#/timeline`, two generated mp4s (clipA = ffmpeg testsrc2 + 440 Hz, clipB = SMPTE bars + 880 Hz, 640x360 25 fps, 6 s each), imported with Add video, placed with Stage 1 mark in/out + Insert (A 0-3 s, B 3-6 s, each with a linked audio clip and spare source at the cut).
Steps and results:
- Baseline export of the plain two-clip timeline first (no features): produced `baseline.mp4`.
- Stage 3/5: three new GL effects on B (Exposure, Frosted Glass, Scanlines) through the library picker; Exposure got two parameter keyframes (-2 and +1.5 stops). Saved and visible after reload.
- Stage 2: motion modifier (drift) added on B; auto-key x on A: -30% at 0.26 s, +30% at 1.26 s.
- Stage 1: Nest -> Expand of B (effects and modifier survive); Ctrl+G group of A's picture + audio.
- Stage 6: vendored `glt-directional-wipe` with params (direction right, smoothness 0), 0.5 s, between A and B.
- Stage 4: master volume 50%, EQ on A's audio (band 2 -> 440 Hz, -12 dB).
- Save (Ctrl+S), real export through the Export tab, reload, reopen the project, check the editor shows 4 clips, the effects and the transition; then strip every new field from the stored project, reload, and confirm the old-format project loads (4 clips, no new console errors). The saved project is read back from the web store (IndexedDB) so persistence is checked against the saved bytes (db-converter rows: `fx_json`, `stage1_json` with `groupId`+`anim`, `stage4_json`, `gl_params_json`, `master_volume`).
- Export frames/audio analysed by `docs/stage-8/smoke/combined-analyze.py` (ffmpeg + numpy):
  - keyed x present: horizontal shift of the exported frame vs the baseline frame: -568 px at 0.26 s (expected -576), +8 at 0.76 s (about 0), +576 at 1.26 s (expected +576): PASS.
  - effects alter pixels: mean abs pixel difference vs the baseline export 16.7 (4.2 s) and 31.9 (5.2 s); keyed Exposure brightens B over time (mean luma 24 -> 86 -> 118 at 3.2/4.2/5.2 s): PASS.
  - mid-transition frame (2.75 s): left of the wipe equals clip B (distance 0.1), right equals clip A (0.6), whole-frame distance to A 72 and to B 50: neither A nor B: PASS.
  - audio: aac stream present; B audio mean volume -27.1 dB (baseline) -> -33.2 dB (master 50% = -6 dB): PASS; A audio -27.1 -> -45.2 dB = -18.1 dB (master -6 plus the -12 dB EQ at 440 Hz, baked): PASS. Baseline export of a plain imported video has audible audio at the source level (-27.1 dB; not silent, not doubled): PASS.
Evidence: `docs/stage-8/evidence/` (`combined-smoke.log`, `combined-results.json`, `combined-export-analysis.json`, `combined-export-frames.jpg`, `combined-edit.png`, `saved-project.json`).

## 3. Analytics (Stage 7) cross-check
- Unit tests: `netlify/functions/__tests__/video-events*.test.js`, `src/lib/editor/publish/__tests__/*` (incl. `analyticsClient.test.js`, `publish.test.js`), `src/lib/editor/projectLibrary/analytics/__tests__/*`, `src/test/heatmap-migration.test.js`: 16 files, 164 tests pass. There is no dedicated `WatchPage` test file; `WatchPage` is imported by `publish.test.js` and `src/test/personalization-analytics.test.js` (both pass; the latter is in the full run).
- Stage 7 browser harness (`tests/browser-harness/heatmaps`, copied to a scratch dir with its worktree paths changed to this tree, local Postgres 16 was available): **SUMMARY passed=19 failed=0** (capture in Chromium, handler into Postgres, owner RPCs, React section, DPR canvas, CSV, print).
- `supabase/tests/run-heatmap-assertions.sh` on local Postgres 16: ALL HEATMAP ASSERTIONS PASSED.
- **Not verified:** the watch page loading a real published video from live Supabase/Netlify (no credentials here); only the capture module, handler and database were exercised.

## 4. Regression review

(a) Preview-vs-export parity, read end to end (`export-mapping.ts` -> `export-prepare.ts` -> `timelineToComposition`, plus `gl-transition-export.ts`):
| Property | Preview | Export |
|---|---|---|
| `Clip.anim` keys + modifiers | yes | yes (`clipAnim`; opacity sampled; test + real frames) |
| fx list + fx param keys (`fx.keys`, `anim` `fx:i:p`) | yes | yes (`occFx` keys) |
| LUT, blend, zoom, transform, fit, captions | yes | yes |
| `eq` | live biquad chain | baked into the audio clip's source (real export shows -18 dB at the notched tone). **Preview-only** for a video clip whose sound is NOT on a linked audio clip (warned in the export dialog) |
| `masterVolume` | yes | yes (applied once per audible item; -6 dB measured) |
| glParams / glType | yes | yes (layer carries params; wipe direction measured) |
| groupId | selection only | not needed |
| compound clip | children shown | flattened (`flattenCompounds`); the compound's OWN keyframes/fx/transform/fades are not applied to its content in either path (Stage 1 limitation) |
| speed ramp | stepped pieces | same pieces (one audible copy per piece, tested) |
| proxy / scene thumbnails / scopes / meters | preview only | export always uses the original file, never the proxy |
Known gap found by the combined run, **consistent in preview and export, not fixed:** during a GL transition window both clips are drawn from their raw frames (preview `GlClipLayer`, export `GlTransitionLayer`), so clip transform, Stage 2 keys/modifiers, effects, fit (the layer hard-codes `cover`) and opacity are not applied inside the window. Measured: A is shifted +30% before the cut and at 0 px inside the transition. Fixing it needs a compositing change (render the styled clips into the transition sources); recorded as a known issue.
(b) Stage 4 "video clip silent when a linked audio clip exists": verified by a real export that a plain imported video keeps audible, un-doubled audio (baseline -27.1 dB for a -27 dB source), master volume and EQ apply once; unit tests cover: unlinked video keeps its own sound, dangling link keeps sound, speed-ramp pieces and a compound each keep exactly one audible copy. No bug found.
(c) Save/load: one test round-trips every field added by Stages 1-6 through the real row converters and JSON (`stage8-integration.test.ts`), plus a compound with animated/effected/EQ'd children, plus an old row set without any new column, plus the JSON-project migration. The browser run checked the same on the real stored project and an old-format project. The web store is a JSON key-value store (IndexedDB), so no SQL column is needed for the new `*_json` fields; **a Supabase-backed project table was not exercised (no credentials)**.
(d) `#/timeline-classic` opens, its Recorder modal opens, CineGen's edit tab (with its voice-over/recorder control) opens: `docs/stage-8/smoke/routes-smoke.cjs`, no console/page errors (benign Supabase/Clerk configuration warnings and the camera-permission error are filtered, see script).
(e) timeline-parity budget: unchanged. The only failing line is the baseline `timeline-editor.tsx` 224 > 220 (identical to before Stage 1); the test file and the budgets were not edited.

## 5. Errors found
| # | Error | Status |
|---|---|---|
| 1 | **Adding a transition between two clips moved B's picture left by the transition length but left B's linked audio in place** (`addTransition`, older code, hit by every dissolve and by the new GL transitions): B's audio ran `duration` seconds late against its picture, and the export ended with black picture for the last `duration` seconds while the audio continued (seen in the first combined export: black at 5.5 s, B ending at 5.49 s, audio to 6.0 s). | **Fixed** (`src/cinegen/lib/editor/timeline-operations.ts`: B's in-sync linked clips shift with it; slipped audio keeps its offset). Regression tests in `stage8-integration.test.ts` (fail without the fix). Re-verified in the real app: B picture and audio start both at 2.493 s and the final export shows B on screen at 5.2 s. |
| 2 | The GL transition window drops clip transform/keys/effects/fit/opacity (above). | Not fixed (design change), in known issues. |
| 3 | Smoke harness flakes (stage 1 cold start, stage 2 render under load). | Harness only; passed on rerun. |
No other interaction errors were found by the scenario, the integration tests or the review.

## 6. Known remaining issues
- GL transitions render raw clip frames (item 2). Classic-name-to-GL fallback is also not wired (Stage 6).
- `removeTransition` removes the transition but does not shift B back (older behaviour).
- After a reload an imported local video/audio keeps its `blob:` URL, which is gone: the clips load without media until relinked (Stage 4 relink) or uploaded to cloud storage. Older behaviour, not caused by Stages 1-7; the combined run therefore exports before reloading.
- EQ on a video clip whose sound is not on a linked audio clip is preview-only (warned).
- Compound clip's own animation/effects are not applied (Stage 1).
- Baseline `timeline-parity` failure (`timeline-editor.tsx` 224 > 220) and the `legacyCards.test.ts` failure are pre-existing.

## 7. Validation checklist (plan lines)
| Area | Check | Result | Evidence |
|---|---|---|---|
| Editing | Insert/overwrite, marks, J/K/L, group, nest/expand, ramp | PASS (browser) | stage1 smoke; combined run (group, nest/expand) |
| Editing | Keyframes + modifiers + curves | PASS (browser) | stage2 smoke; combined run |
| Editing | New GL effects (21), param keyframes | PASS (shader level + in app) | fx-gl-check 21/21; combined run |
| Editing | Transition picker, params | PASS (in app + export) | stage6 smoke; combined run |
| Editing | Master volume, EQ, meters, scenes, proxy | PASS (browser) | stage4 smokes; combined run |
| Editing | Save / reload / old-format project | PASS (web store); Supabase **not verified** | combined run, `stage8-integration.test.ts` |
| Rendering | Keyed position in real export | PASS | -568 / +8 / +576 px |
| Rendering | New effects alter export, keyed effect param changes | PASS | frame diffs, luma ramp |
| Rendering | GL transition mid-frame is neither clip | PASS | region distances |
| Rendering | Audio present, master volume, EQ in export | PASS | volumedetect |
| Rendering | Transform/effects inside a GL transition window | FAIL (known limitation, preview = export) | A shift 0 px inside window |
| Rendering | H.264 on real hardware / other browsers | **not verified** (Chromium 153 SwiftShader only) | |
| Personalization | Existing personalization unit tests | PASS except the baseline `legacyCards.test.ts` failure (pre-existing); browser personalization flow **not verified** | section 9 |
| Analytics | Capture, handler, Postgres, owner RPCs, heatmap UI | PASS (local Postgres 16 harness 19/19, SQL assertions pass) | section 3 |
| Analytics | Watch page against live Supabase/Netlify, deploy preview | **not verified** | |
| Regression | Classic editor + recorder open | PASS | routes-smoke |
| Regression | timeline-parity budgets | unchanged (baseline failure remains) | |

## 8. Unverified
Live Supabase (project save/load through the hosted tables, storage), Netlify functions/deploy preview, other browsers (Firefox, Safari), real GPU WebGL and real H.264 encoders, signed-in flows, long projects, and the personalization editing flow in a browser.

## 9. Test numbers
Full `npx vitest run` after the fix: **Test Files 2 failed | 783 passed | 1 skipped (786); Tests 2 failed | 11443 passed | 64 skipped (11509)**. The 2 failures are the two baseline ones (`timeline-parity` `timeline-editor.tsx` 224 > 220, `legacyCards.test.ts`); before Stage 8 the merged tree had 11433 passed, so +10 = the new `stage8-integration.test.ts`. ESLint on the two changed source/test files: 0 errors.
