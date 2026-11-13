# SmartVideo AI — Stage 0: FreeCut + Seriously.js + GL Transitions + heatmap.js Audit

Branch: `claude/focused-brown-9xfv3c` (base `c61aa440f`, = `origin/develop`). **Audit only — no application code, dependency, migration or deployment was changed.** Stages 1–8 are NOT authorized.

Detailed evidence (file-level tables) is in the appendices next to this file:
`appendix-freecut.md`, `appendix-seriously-gltransitions-heatmapjs.md`, `appendix-smartvideo-editor.md`, `appendix-smartvideo-analytics.md`.
Findings come from code reading (spot-checked by the lead on licences, transition counts, Remotion peer deps). Nothing was run in a browser and no media was rendered in Stage 0.

## 0. Upstream pins

| Project | Commit audited | Last commit | Licence | State |
|---|---|---|---|---|
| FreeCut | `5ceeeb388eef5423640b7db157706274bf1b8165` | 2026-10-29 | MIT (but `src/infrastructure/audio/time-stretch.ts` is SoundTouch **LGPL-2.1+**) | Active |
| Seriously.js | `513d2b8696b76fe764b3033aa6dc7c99005acccd` | 2015-09-08 | MIT repo, **mixed per-effect licences** | Abandoned, WebGL1 only |
| gl-transitions | `d2f250e5cee85d9cfb225b584aeabecfbf8dea42` | 2026-11-13 | MIT; 218 MIT / 1 BSD-3 / 1 BSD-2 per file | Active |
| heatmap.js | `4e64f5ae5754c84fea363f0fcf24bea4795405ff` | 2017-02-02 | MIT (build header also says "Beerware") | Unmaintained |

## 1. Coordination with the other master implementation
- A separate plan exists on `origin/claude/jolly-cannon-ofqf7h` (`docs/SMARTVIDEO_MASTER_ENHANCEMENT_PLAN.md`). Its Stage 0 is docs-only; its Stages 1–12 are not authorized. Nothing there conflicts with this branch today.
- **Future overlap (needs a decision before Stage 1+):** its Stage 4 (audio), 5 (effects/motion), 6 (captions), 8 (publishing/watch pages), 11 (analytics) cover the same ground as our Stages 3/4/5/6/7. Also, it excludes the Recorder; we preserve it.
- In-flight branches touching our target files: `claude/upbeat-goodall-9lmvej` (WatchPage.jsx, interactivePlayer.js, publishClient.js, addons — overlaps Stage 7 CTA tracking and `TimelineEditorPage.jsx`), `claude/laughing-babbage-v4ti68` (`analytics-tab.tsx`, `projectsPanel.js` — overlaps Stage 7 UI), `claude/modest-tesla-yhjel6` (`20261113000000_video_campaigns.sql`; three branches already use the `20261113*` migration prefix → use a later timestamp), `claude/festive-fermat-yvt77e` (Recorder port).
- Recommendation: do not start any stage touching those files until those branches merge or the user sequences them.

## 2. Headline findings
1. **Three editors, one exporter.** CineGen (`#/timeline`, `src/cinegen/`, flat `clips[]` in seconds) is the default; classic (`#/timeline-classic`, `items[]` in %) and `src/openchatcut/` (GL fx, LUTs, captions, audio analysis) feed the same `timelineToComposition` → `TimelineComposition` → `renderMediaOnWeb` path. New work should target CineGen.
2. **Preview/export parity gaps already exist** (CineGen `web-api.ts` hand-off; agent-reported, partly spot-checked): track mute/solo/volume/visibility, volume >1, static opacity/flip and plain dissolve/fade transitions are not sent to export; classic GPU transitions fall back to CSS in export. Stage 8 acceptance ("exported = preview") will fail unless these are fixed first.
3. **FreeCut cannot be ported wholesale**: it does not use Remotion; effects are WebGPU/WGSL only; requires Chromium 113+, WebGPU, WebCodecs, OPFS, COOP/COEP. Only pure-logic modules are portable (see §4).
4. **gl-transitions is already a dependency** (`gl-transitions ^1.43`, 125 names in classic, 16 GLSL in CineGen). Upstream is now 220 shaders / npm 3.2.0. The official Remotion adapter requires `makeHtmlInCanvasPresentation` + `webgl2` and its web-renderer compatibility is **unverified** → needs a real spike before Stage 6.
5. **Seriously.js licence trap**: `blur`, `directionblur`, `bleach-bypass`, `opticalflow` are **CC BY-NC-SA 3.0** (non-commercial) — must not be copied; `filmgrain` CC BY 3.0 (attribution); `lut` BBC R&D "with permission" (no licence text); `blend` has an unresolved credit TODO. Verified by grep. Repo is also AGPL-3.0 (per the other plan), so MIT/BSD inbound is fine; NC-SA is not.
6. **Analytics: no spatial data exists.** No click x/y, scroll depth, pointer or per-second watch data; no impression event; CTA types are only URL / PHONE / lead-form identified by free-text label. heatmap.js is not installed. The existing `heatmap-grid.tsx`/`map-heat-overlay.tsx` are Remotion video primitives, unrelated to analytics.
7. **No client-report/export feature exists** (no PDF/CSV). Stage 7.7 would be new, not an enhancement.
8. **Security items affecting Stage 7**: raw `contact_id` stored while UI calls viewers "anonymous"; `campaign_recipients` holds plaintext email; legacy `record_video_event` anon-callable without rate limit; default hash salt; limiter fails open.

## 3. Feature matrix

Legend: 1 implemented+tested · 2 implemented but broken/not in export · 3 partial · 4 missing · U upstream better · A needs adaptation · X incompatible · N not worth it. "Export" = effective in Remotion Web Renderer path per audit.

### 3a. Timeline editing (FreeCut → SmartVideo)
| Capability | SmartVideo today | Class | Upstream source | Plan |
|---|---|---|---|---|
| Ripple / roll / slip / slide | Both editors; CineGen `timeline-operations.ts` (76 tests) | 1 | `features/timeline/utils/{slip,slide}` pure helpers | Skip or cross-check only |
| Linked A/V, track mute/solo/lock | Implemented; mute/solo not exported | 1/2 | zustand-coupled | Fix export hand-off |
| Insert / overwrite | CineGen none; classic drop-time only | 3 | `items-store` (coupled) | A (new op in CineGen) |
| Mark in/out, source monitor | CineGen none; classic `setInOut` | 3/4 | `utils/in-out-points`, `source-calculations` | A |
| Rate stretch / speed ramp | `speed` scalar only; no ramp | 3 | `audio/time-stretch.ts` (LGPL) | A; avoid LGPL file |
| Snapping, markers, timecode | Present in CineGen (verify in Stage 1) | 1 | `timeline-snap-utils`, `razor-snap` | Skip unless gaps |
| Compound clips, grouping, multiple sequences | Missing | 4 | `composition-graph` (portability unconfirmed) | A |
| Keyboard shortcuts / undo-redo | Undo present; CineGen lacks I/O/JKL | 3 | `config/hotkeys.ts` | A |

### 3b. Animation
| Capability | SmartVideo | Class | Upstream | Plan |
|---|---|---|---|---|
| Keyframe data | 3 schemas; classic never reaches export; CineGen UI = opacity/volume linear + effect sliders + transform | 3 | `keyframes/utils/interpolation.ts` | A; unify on one schema |
| Bezier easing | OpenChatCut engine supports cubic-bezier; no UI | 3 | `shared/utils/easing.ts` (bezier+spring, pure) | U/A |
| Graph editor / dopesheet / auto-key | Missing | 4 | UI coupled | Build UI, reuse math |
| Spring | Not wired | 4 | `easing.ts` | A |
| Drift / sway / breathing / spin / shake | Missing | 4 | `motion-modifier-eval.ts` (portable) | A — must be frame-deterministic |
| Per-char/word/line text motion | Missing/partial in captions | 3/4 | text-motion evaluators | A |
| Animated masks/crop/effect params | Effect-slider keys only | 3 | coupled | A |
| Lottie colour/text edit | Lottie playback only (lottie-web) | 3 | `lottie-*` files | A (verify) |

### 3c. Effects, compositing
| Capability | SmartVideo | Class | Upstream | Plan |
|---|---|---|---|---|
| Colour grading basics, LUT | 34 GL fx + 16 LUTs (CineGen), user `.cube`; 88 `@remotion/effects` (classic) | 1 | FreeCut WGSL (not reusable) | Skip duplicates; fill gaps |
| Curves, levels, colour wheels, gradient map | Not confirmed present | 3/4 | WGSL → needs GLSL port | A (re-implement as GLSL) |
| Blur/distortion/stylized set | Mostly present across the two effect sets | 1/3 | WGSL / Seriously GLSL | Gap list in appendix |
| Pixel sort, ASCII, halftone, VHS, CRT | Partially via `@remotion/effects`; gaps per appendix | 3 | WGSL compute (pixel sort) | A / N for compute |
| Chroma key, spill, blend modes | Chroma key + blend modes exist; spill unverified | 3 | `gpu-effects/keying` | A |
| Pen-path masks, animated masks | Missing | 4 | `mask-path-utils` | A |
| Corner pin | `@remotion/effects` entry only, no handles | 3 | coupled | A |
| Scopes | `colorScopes.js` (histogram/waveform/vectorscope); RGB parade missing; `colorCorrectionSystem.jsx` init commented out | 2/3 | FreeCut scopes (GPU-coupled) | Fix/activate existing |

### 3d. Seriously.js effect candidates (22 requested; full table in appendix)
| Effect | Licence-safe? | Portable single-pass? | Already in SmartVideo? | Verdict |
|---|---|---|---|---|
| filmgrain | CC BY 3.0 (attribute) | yes | likely (GL grain) | Skip unless better |
| blur, directionblur, opticalflow | **CC BY-NC-SA — do not copy** | — | blur exists elsewhere | **X** (re-implement independently) |
| chroma, luma key, vignette, kaleidoscope, pixelate, ripple, scanlines, edge/emboss, noise, sketch, nightvision, displacement, whitebalance, exposure | MIT | yes (WebGL1 GLSL) | partial overlap | A for non-duplicates |
| tvglitch, freeze, lut | particle pass / runtime logic / unclear licence | no | LUT exists | N / skip |

### 3e. Transitions (GL Transitions)
| Item | Finding |
|---|---|
| Catalog | 220 shaders (218 MIT, BSD-3 `InvertedPageCurl`, BSD-2 `StereoViewer`); only `LumaWipe`, `DisplacementMap` need extra textures. GLSL ES 1.00 contract (`progress`, `ratio`, `getFromColor/getToColor`) |
| SmartVideo | CineGen 16 GLSL (burned into export); classic 125 names but GPU ones fall back to CSS in export; `glTransitionRenderer.js`, `transitionMap.js` |
| Official adapter | `@gl-transitions/remotion` 2.0.0; peers remotion/`@remotion/transitions` ≥4.0.500 (we pin 4.0.540 ✔), `gl-transitions ^3.2.0` (we have ^1.43 ✘); uses `makeHtmlInCanvasPresentation` (Studio needs Chrome 149 + flag per audit) → **likely not usable in `renderMediaOnWeb`; spike required**. Fallback: vendor the 12-line `renderer.ts` prelude + individual GLSL |
| Recommendation | Reuse existing `glTransitionRenderer.js` path; add shaders from a generated manifest with per-shader licence; fix classic export fallback first |

### 3f. Media intelligence / audio / performance
| Capability | SmartVideo | Class | Notes |
|---|---|---|---|
| Scene detection / browser | Not confirmed in CineGen; other plan lists as missing | 4 | |
| Filmstrips, proxies | `proxyGenerator.js` orphaned (`lib/editor/index.js` has no importers) | 2 | Re-wire |
| Relinking | Missing | 4 | |
| Captions / transcription | Present (`captions.js`, openchatcut captions, Whisper worker) | 1 | Skip |
| Local TTS / music gen | Missing; FreeCut uses large model weights of unknown licence | 4/N | Needs authorization |
| Audio: volume/fades | Present; track/master/>1 volume not exported | 2 | Fix export |
| EQ, pitch, meters | Missing | 4 | `audio-eq.ts` (1673 lines, pure TS) portable; pitch = LGPL SoundTouch |
| Multi-cam | `multiCam.js` present (verify usage) | 3 | |

### 3g. Heatmap / engagement (Stage 7)
| Item | Exists today | Class | Gap |
|---|---|---|---|
| Click heatmap | no x/y capture | 4 | New event + normalization + table + RPC |
| CTA engagement | cta_click/call_click counts, performance RPC | 3 | No impression event → no valid CTR denominator; no typed CTAs |
| Video engagement | 1% coverage buckets, retention curve, section engagement, replay events | 3 | No per-second/skip/drop-off storage; chart can be custom 1-D canvas |
| Scroll depth | none | 4 | |
| Pointer movement | none | 4 / N | Recommend omitting (privacy) |
| Campaign/recipient analytics | `?c` contact totals; campaign schema only on unmerged branch | 3 | Depends on modest-tesla merge |
| Filters | date range only | 3 | video/campaign/CTA/device missing |
| Reports/export | none | 4 | |
| heatmap.js | not installed; v2.0.5, unmaintained, canvas2d, UMD global `h337`, no scaling/DPR/types, no React wrapper | U? | See §5 |

## 4. FreeCut portable shortlist (see appendix for the ranked 15)
Pure TS with only type dependencies: `shared/utils/easing.ts`, `keyframes/utils/interpolation.ts`, `motion-modifier-eval.ts`, text-motion evaluators, `shared/utils/audio-eq.ts`, `audio-silence.ts`, `timeline/utils/{slip,slide,source-calculations,in-out-points,timeline-snap-utils,razor-snap}`. Not portable: Player/Clock/renderer, WGSL gpu-effects, stores, masks, scopes, proxies, transcription/TTS/music. Agent read import lists/headers only, so portability of `composition-graph`, `mask-path-utils`, `transform-calculations`, `lottie-*`, `rank.ts` is **unconfirmed**.

## 5. Dependency, licence, compatibility findings
- No new dependency is required for Stages 1–5 if upstream code is vendored as individual files.
- FreeCut build uses vite-plus/TypeScript 7; SmartVideo is Vite 5 → do not mirror its toolchain.
- LGPL (`time-stretch.ts`): avoid or isolate; repo itself is AGPL so LGPL linking is legally workable but needs counsel confirmation. NC-SA Seriously effects: exclude.
- Dependency/model licences in FreeCut (MusicGen, captioning, Whisper, CLIP, Anime4K weights MIT) are **not verified**.
- heatmap.js: technically adequate for a 2-D overlay (we can aggregate server-side and draw), but unmaintained, pixel-exact aggregation, no DPR handling. Alternative: a small in-house canvas radial-gradient renderer (~100 lines). Decision for approval.
- Attribution files needed: per-shader licence manifest (GL Transitions), per-effect notice (Seriously), FreeCut MIT notice.

## 6. Rendering considerations
- Everything must pass `renderMediaOnWeb` in the sandboxed `export-runner`. Preview-only paths (classic `KeyframeSystem`, CSS-fallback transitions, `colorCorrectionSystem.jsx`) do not count.
- WebGL2 availability inside the export iframe and per-frame determinism for procedural motion (seeded noise, no `Date.now`) are untested.
- Fix existing export hand-off losses before adding new features, otherwise Stage 8 cannot pass.

## 7. Analytics event availability
Available: ~17 event types (play, pause, progress milestones, replay, section_rewatch, cta_click, call_click, lead_submit…), `watch` segments, session hashing, DNT/GPC and `?consent=`, batching, idempotency on (session, seq), 90-day raw retention. Not available: pointer x/y, element bounding boxes, scroll depth, impressions, device class (verify), per-second watch. All new columns/RPCs need new migrations with a post-`20261113*` timestamp, RLS owner checks, and the Clerk-vs-Supabase auth convention decision flagged by the other plan.

## 8. Baseline test results
_Pending: full vitest run in progress at commit time; numbers added in the follow-up commit._

## 9. Recommended stage modifications
1. **Insert a "Stage 0.5 / pre-work" fix stage** (or fold into Stage 1): close CineGen export hand-off gaps (§2.2); without it every later "verified in export" claim is unreliable.
2. **Stage 1**: skip ripple/roll/slip/slide (already implemented); focus on insert/overwrite, mark in/out + source monitor, I/O/JKL shortcuts, rate/speed ramp, compound clips/grouping, multiple sequences. Target CineGen only.
3. **Stage 2**: first unify keyframe schema (3 exist); reuse FreeCut easing/interpolation/motion evaluators; build bezier editor/dopesheet UI; Lottie edit needs a spike.
4. **Stage 3**: don't port WGSL; add only genuine gaps (curves, levels, wheels, gradient map, spill suppression, pen masks, corner-pin handles, RGB parade) as GLSL; reactivate `colorScopes`.
5. **Stage 4**: audio EQ/meters from `audio-eq.ts`; no pitch shift via LGPL without approval; re-wire `proxyGenerator.js`; local AI items require separate authorization (model licences/size).
6. **Stage 5**: reduce scope to non-duplicate, MIT-licensed single-pass shaders; explicitly exclude the four NC-SA effects.
7. **Stage 6**: begin with a spike proving the official adapter (or vendored shaders) in `renderMediaOnWeb`; then generate catalog from `transitions/*.glsl` metadata.
8. **Stage 7**: split: 7a event capture + migrations (clicks, scroll, impressions, per-second watch buckets, typed CTAs), 7b visualization (custom 1-D chart for video; heatmap.js or in-house canvas for 2-D), 7c reports/export. Omit pointer movement. Sequence after `upbeat-goodall` and `laughing-babbage` merge.
9. Decide whether to align with the other master plan's stage numbering to avoid duplicate work (audio/effects/analytics).

## 10. Open questions for the user
1. Sequence vs. the other master implementation (and its un-merged branches)?
2. Approve the export hand-off fix as pre-work?
3. heatmap.js (unmaintained, MIT/Beerware header) vs in-house canvas renderer?
4. Is LGPL SoundTouch acceptable, or skip pitch shifting?
5. Any appetite for FreeCut's local-AI features (large model downloads)?
