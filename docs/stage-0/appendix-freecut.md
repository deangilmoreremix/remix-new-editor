# FreeCut source inventory (commit 5ceeeb388eef5423640b7db157706274bf1b8165)
All paths relative to repo root; `src/` omitted via prefix `S/` = `src/`. Line counts are `wc -l` of files opened/listed. "Portable" = pure TS, depends only on `@/types/*`; "Coupled" = imports zustand stores / GPU / renderer / DOM.
Caveat: I listed + counted files and read import lines/headers of the key ones; I did NOT read every function body. Items marked (grep) were located by grep only.

## 0. Headline findings
- Licence: MIT (LICENSE, "Copyright (c) 2025 FreeCut"). Exceptions: `S/infrastructure/audio/time-stretch.ts` (672 l) is SoundTouch JS v0.2.3 = **LGPL-2.1+** (full text in `S/infrastructure/audio/THIRD_PARTY_LICENSE`, 501 l). Anime4K ONNX weights: MIT (bloc97, sb2702/websr) per `S/infrastructure/upscale/models/NOTICE.md`. `public/moss-tts/*` vendored (licence not inspected = unknown).
- **No Remotion at all.** `grep -ri remotion` over src/package.json/README/CLAUDE.md hits only unrelated words ("restoreMotionReturn..."). Own renderer: `S/runtime/player/*` (Player, Clock), `S/runtime/composition-runtime/*` (React DOM preview), `S/runtime/renderer/*` (WebCodecs/mediabunny export, WebGPU compositing).
- Rendering is **WebGPU/WGSL** (`/* wgsl */` shaders, `@fragment`, compute passes) with Canvas2D/DOM fallbacks "where practical". Zero GLSL/WebGL found for effects.
- Hard requirement: Chromium + WebGPU + WebCodecs + OPFS + File System Access API; COEP `require-corp` + COOP `same-origin` set in vite.config.ts L112-122 and vercel.json (=> crossOriginIsolated / SharedArrayBuffer).
- Stack: React 19.2.5 (exact pin), TypeScript 7.0.2, `vite-plus` 1.1.0 with `vite` overridden to `npm:@voidzero-dev/vite-plus-core@1.1.0` (NOT Vite 5), vitest 5.0.3, zustand 5.0.12, Tailwind 4.2.2, TanStack Router 1.168, Radix, mediabunny 1.54.0, @huggingface/transformers 4.1.0, onnxruntime-web 1.26.0-dev, kokoro-js 1.2.1, motion 12.40.0, zod 4.3.6. Node 22+, npm 11+.

## 1. Timeline editing
| Feature | Files (lines) | Notes / portability |
|---|---|---|
| Ripple/trim/split/join/freeze/range-removal | `S/features/timeline/stores/actions/edit/trim-actions.ts` (878), `split-actions.ts` (245), `join-actions.ts` (92), `freeze-frame-actions.ts` (253), `range-removal-actions.ts` (354), `edit/shared.ts` (97); `S/features/timeline/stores/actions/sync-lock-ripple.ts` (469); `utils/trim-utils.ts` (274), `utils/trim-edit-constraints.ts`; UI `hooks/use-timeline-trim.ts` (1422); preview overlay `S/features/preview/components/ripple-edit-overlay.tsx` | Actions coupled to zustand items-store; trim-utils imports compositions-store (semi-coupled) |
| Rolling | `S/features/preview/components/rolling-edit-overlay{,-utils}.tsx`, `stores/rolling-edit-preview-store.ts`, `roll-hover-store.ts`; logic inside trim-actions/use-timeline-trim | Coupled |
| Slip / Slide | `utils/slip-utils.ts` (33, zero imports), `utils/slide-utils.ts` (42; imports clip-utils, slip-utils, source-calculations, types), `utils/slide-keyframe-constraints.ts`, `hooks/use-timeline-slip-slide.ts` (1515), overlays `slip-edit-overlay.tsx`, `slide-edit-overlay.tsx` | utils portable; hook coupled |
| Linked A/V | `utils/linked-items.ts` (465; imports items-store -> coupled), `stores/actions/linked-edit.ts` (145), `utils/linked-drag-targeting.ts`, `S/shared/utils/linked-media.ts`, `S/runtime/renderer/audio/linked-media.ts` (89) | Mixed |
| Rate stretch | `stores/actions/edit/rate-stretch-actions.ts` (475), `hooks/use-rate-stretch.ts` (779), `utils/source-calculations.ts` (315, pure, imports only types) | source-calculations portable |
| Source monitor | `S/features/preview/components/source-monitor.tsx` (1579), `inline-source-preview.tsx`, `source-composition.tsx`, `S/shared/state/source-player/{store,types}.ts` (61/48), `S/features/preview/utils/source-io.ts`, `source-media-sync.ts` | UI coupled to player/media stores |
| Mark in/out | `utils/in-out-points.ts` (82, types only), `hooks/use-in-out-points.ts`, `hooks/shortcuts/use-in-out-shortcuts.ts`, `stores/in-out-bound.ts`, `S/shared/timeline/io-range/*` (io-range-drag 76, geometry 63, markers.tsx 249) | in-out-points + io-range-geometry portable |
| Insert/Overwrite | `stores/actions/source-edit-actions.ts` (376), `utils/source-edit-targeting.ts`, `utils/source-range-intervals.ts`, `S/features/preview/deps/timeline-source-edit.ts` | Coupled to items-store |
| Markers | `stores/markers-store.ts` (73), `stores/actions/marker-actions.ts` (133), `S/shared/timeline/marker-names.ts`, `timeline-annotations.ts` (89), `hooks/shortcuts/use-marker-shortcuts.ts` | small, zustand |
| Timecode | `S/shared/utils/time-utils.ts` (132; formatTimecode, formatTimecodeCompact, DotFrames, signed delta, secondsToFrames/framesToSeconds, formatDuration; zero imports) ; `S/features/preview/components/timecode-display.tsx` (108) | **Portable** (NDF only; no drop-frame seen) |
| Snapping | `utils/timeline-snap-utils.ts` (306; imports types/drag + transition types), `utils/razor-snap.ts` (90), `hooks/use-snap-calculator.ts` (186), `S/features/preview/utils/canvas-snap-utils.ts` (610), `snap-guides.tsx`, `utils/snap-target-state.ts` | utils portable-ish |
| Track controls | `stores/actions/track-actions.ts` (19), `track-height-actions.ts`, `utils/track-heights.ts`, `track-resize.ts`, `track-sync-lock.ts`, `track-item-compatibility.ts`, `track-removal.ts`, `hooks/use-track-drag.ts`, `use-track-push.ts`, `use-track-height-resize.ts`, `use-timeline-tracks.ts`; mute/solo/lock live in items-store (966 l) | Coupled |
| Compound clips / sub-compositions | `stores/compositions-store.ts` (132), `stores/actions/composition-actions.ts` (1575), `composition-*-actions.ts`, `utils/composition-graph.ts` (104), `composition-clip-summary.ts`, `sub-composition-normalizer.ts`, `S/features/media-library/services/compound-clip-thumbnail-service.ts`, `S/runtime/renderer/audio/nested-composition.ts` (454) | Coupled; composition-graph likely pure (imports not checked) |
| Multiple sequences | `stores/sequences-store.ts` (149), `S/features/export/components/export-sequence-picker.tsx` | zustand |
| Keyboard shortcuts | `S/config/hotkeys.ts` (901; central registry), `S/features/editor/hooks/use-editor-hotkeys.ts`, `S/features/timeline/hooks/shortcuts/use-{clipboard,editing,in-out,marker,playback,source-monitor,tool,ui}-shortcuts.ts`, settings editor `S/features/settings/components/hotkey-editor-sections.ts`; lib `react-hotkeys-hook` 5.2.4 | hotkeys.ts is data-like, mostly portable |
| Undo/redo | `stores/timeline-command-store.ts` (286; snapshot-based per-context undo/redo stacks with labels), `stores/commands/{snapshot,types,labels}.ts`, `S/features/editor/utils/project-metadata-history.ts` | Snapshot approach, zustand; concept portable |
| Extras found | silence removal, filler-word removal, transcript-based editing (`utils/transcript-edit-model.ts`, `silence-*`), transitions (`stores/transitions-store.ts`, `S/shared/timeline/transitions/`, `utils/transition-*.ts`), classic/bento layouts, sync-lock ripple | |

## 2. Animation / keyframes (`S/features/keyframes`, `S/shared`, `S/types`)
| Feature | Files (lines) | Portability |
|---|---|---|
| Bezier graph editor | `S/features/keyframes/components/value-graph-editor/index.tsx` (1431), `use-graph-interaction.ts` (784), `graph-curve.tsx` (404), `graph-grid.tsx` (272), `use-graph-viewport.ts` (264) | React UI; coupled to timeline/keyframe stores via `deps/*` |
| Dopesheet | `.../components/dopesheet-editor/index.tsx` (1067) + ~30 files (segment-easing-popover 747, easing-curve-editor 587, use-keyframe-drag 351, ...) ; motion dopesheet `S/features/editor/components/compose-workspace/motion-dopesheet-content.tsx` | Coupled UI |
| Multi-property keyframes | `utils/animated-transform-resolver.ts` (740; imports composition-runtime contract), `animatable-properties.ts` (78), `shape-/path-/effect-animatable-properties.ts`, `vector-interpolation.ts` (251), `vector-promotion.ts`, `property-expression.ts` (379; types only), `stores/keyframes-store.ts`, `stores/actions/keyframe-actions.ts` | property-expression + vector-interpolation portable |
| Auto-keyframe | `S/features/keyframes/utils/auto-keyframe.ts` (209), `stores/auto-keyframe-store.ts` (81) | Coupled (timeline contract) |
| Interpolation | `utils/interpolation.ts` (92; imports types + easing) | **Portable** |
| Easing presets / custom bezier / spring | `S/shared/utils/easing.ts` (123; types only), `utils/easing.ts` (re-export), `utils/easing-presets.ts` (182), `utils/animation-easing.ts` (46), types `S/types/keyframe.ts` (614; EasingType incl. `cubic-bezier` + `spring` with SpringParameters, DEFAULT_SPRING_PARAMS) | **Portable** |
| Procedural drift/sway/breathing/spin/shake | `S/features/keyframes/utils/motion-modifier-eval.ts` (393; imports motion-generator, types), `motion-generator.ts` (137), `motion-modulators.ts` (56), `motion-layer-eval.ts` (220), `trigger-wave-motion-layer.ts` (304), `motion-presets.ts` (555), `bake-motion.ts` (246), `S/types/motion.ts` (93), `S/shared/timeline/procedural-motion.ts` (7). Preview side: `S/features/preview/components/motion-path-overlay.tsx` (143), `utils/motion-path*.ts` | evaluators **portable** (types only) |
| Keyframeable masks / crops / color | `utils/animated-crop-resolver.ts` (100), `utils/color-keyframes.ts` (242; types+easing), `S/runtime/renderer/canvas-keyframes.ts` (217), mask animation via path-animatable-properties.ts | crop/color portable |
| Per-char/word/line text motion | `S/shared/typography/text-motion/{evaluate 422, segment-units 175, text-motion-presets 314, index, text-motion-preset-ids 35}.ts`, `S/types/text-motion.ts` (79), `S/shared/timeline/text-motion-timeline.ts` (103), `S/features/keyframes/utils/animated-text-item.ts`; GPU text `S/infrastructure/gpu-text/glyph-atlas-text-pipeline.ts` (834) | evaluate.ts **portable** (imports presets, easing, math, types) |
| Curve tools | `S/shared/utils/curve-spline.ts` (135, no imports), `gpu-curves.ts` (353) | portable (monotone spline for curves effect) |
| Animation preset storage | `S/infrastructure/storage/workspace-fs/animation-presets.ts` (475) | FS-coupled |

## 3. Effects — registry `S/infrastructure/gpu-effects/registry.ts` (82)
Technology: **WebGPU/WGSL** (`S/infrastructure/gpu-effects/effects-pipeline.ts` 1395 l; fragment pass default, optional compute pass via `GpuEffectComputeSpec` for pixel sort; effects can bind an aux data texture, e.g. curves LUT / 3D LUT). Canvas2D path: `S/runtime/renderer/canvas-effects.ts` (282) merely hosts the GPU pipeline (`pipeline.applyEffectsToCanvas`); I found no independent Canvas2D implementation of effects there. Effect definition type: `S/infrastructure/gpu-effects/types.ts` (86). Each effect = object {id,name,category,params,shader(WGSL string),entryPoint,packUniforms}; the shader strings are copy-pasteable but need the pipeline's bind layout (binding 0 sampler/tex, 2 uniforms, 3 data tex).
| File (lines) | Effect ids (opened/grepped) |
|---|---|
| `effects/color.ts` (1546) | gpu-brightness, contrast, exposure, hue-shift, invert, levels, saturation, temperature (temp/tint), grayscale, sepia, curves, color-wheels, secondary-qualifier, power-window, vibrance, gradient-map |
| `effects/lut.ts` (85) + `lut/cube-lut.ts` (267, no imports; .cube parser) | gpu-lut |
| `effects/blur.ts` (356) | gaussian-blur, box-blur, motion-blur, radial-blur, zoom-blur |
| `effects/distort.ts` (1718) | pixelate, rgb-split, twirl, wave, trigger-wave, bulge (bulge/pinch), kaleidoscope, mirror, fluted-glass, ripple-glass, glass-mosaic, blocks, droste |
| `effects/stylize.ts` (2880) | vignette, grain, sharpen, posterize, glow, edge-detect, scanlines, color-glitch, block-glitch, crt, halftone, dither, ascii, threshold, vhs, ink, pixel-sort, pixel-sort-hq |
| `effects/keying.ts` (109) | gpu-chroma-key (incl. softness + spillSuppression param; spill = green-channel clamp, simple) |
Absent as separate ids: "brightness+contrast combined" no; pinch is the bulge effect (not confirmed negative param). Unsharp/denoise absent.
Types: `S/types/effects.ts` (182). Presets: `workspace-fs/effect-presets.ts` (90). UI: `S/features/effects/{components,hooks,stores,utils}`. Transitions (WGSL): `S/infrastructure/gpu-transitions/` (2341 l; fade, wipe, slide, flip, iris, clock-wipe, dissolve(+variants), glitch, chromatic, pixelate, radial-blur, liquid-distort, lens-warp-zoom, film-gate-slip, light-leak-burn, sparkles).

## 4. Compositing
| Feature | Files (lines) | Notes |
|---|---|---|
| Chroma key + spill | `S/infrastructure/gpu-effects/effects/keying.ts` (109) | WGSL, self-contained shader; needs pipeline |
| Blend modes | `S/types/blend-modes.ts` (111; normal, dissolve, darken/multiply/color-burn/linear-burn, lighten/screen/color-dodge/linear-dodge, overlay/soft/hard/vivid/linear/pin-light, ... Photoshop set), `S/types/blend-mode-css.ts` (76; CSS mapping), `S/infrastructure/gpu-shared/blend-modes.ts` (232; WGSL), `gpu-media/media-blend-pipeline.ts` (125) | WGSL snippet reusable |
| Masks (bezier pen paths) | types `S/types/masks.ts` (8; MaskVertex w/ tangentMode); `S/features/preview/components/mask-editor-overlay.tsx` (1888), `mask-editor-drawing.ts`, `-pen-render-plan.ts`, `-pointer-drag.ts`, `-vertex-selection.ts`; `utils/mask-path-utils.ts` (231), `path-fit.ts` (148); `S/runtime/renderer/canvas-masks.ts` (546); GPU `S/infrastructure/gpu-masks/mask-combine-pipeline.ts` (114); `S/shared/utils/mask-scope.ts`; `utils/path-geometry-persistence.ts` | mask-path-utils/path-fit pure candidates; overlay coupled |
| Animated masks | `utils/path-animatable-properties.ts` + `S/runtime/renderer/canvas-keyframes.ts` | coupled |
| Corner pin | `S/features/preview/components/corner-pin-overlay.tsx` (392), `corner-pin-container.tsx` (80); render test `canvas-item-renderer.corner-pin.test.ts`; code under `S/runtime/renderer/canvas-item-renderer/` | coupled |
| Transform gizmos | `transform-gizmo.tsx` (678), `gizmo-overlay.tsx` (1563), `gizmo-handles.tsx`, `group-gizmo.tsx`; pure math: `utils/transform-calculations.ts` (292), `coordinate-transform.ts` (163), `gizmo-transform-interaction.ts` (113), `group-transform-calculations.ts`, `anchor-gizmo.ts`, `crop-gizmo.ts` | math files portable candidates (imports not checked) |
| Shapes | `S/shared/graphics/shapes`, `S/infrastructure/gpu-shapes/shape-render-pipeline.ts` (613), `S/runtime/renderer/canvas-shapes.ts` | |
| GPU compositor | `S/infrastructure/gpu-compositor/{compositor-pipeline 610, gpu-texture-pool 216}.ts` | Not portable |

## 5. Media intelligence
| Feature | Files (lines) | Notes |
|---|---|---|
| Scene detection | `S/infrastructure/analysis/scene-detection.ts` (449), `histogram-scene-detection.ts` (159), `adaptive-scene-detector.ts` (257; imports only scene-detection-types), `adaptive-scene-detection-worker.ts` (218), `scene-detection-utils.ts` (78), `scene-detection-types.ts` (46); `S/features/timeline/utils/scene-cut-frames.ts` | adaptive-scene-detector portable |
| Scene captioning / verification | `analysis/captioning/{scene-caption-format 430, lfm-captioning-provider 270}`, `lfm-scene-worker.ts` (264), `gemma-scene-worker.ts` (201), `analysis/verification/*`, `S/shared/utils/scene-verification-models.ts` | local LFM / Gemma VLMs via transformers.js (model licences = unknown, check HF cards) |
| Scene browser/search | `S/features/scene-browser/` : components (scene-browser-panel, scene-card, ...), `utils/{rank, semantic-rank, embeddings-cache, library-palette, color-boost, color-convert, seek, invalidate}.ts`, `hooks/use-semantic-index.ts`, `use-ranked-scenes.ts`; embeddings `analysis/embeddings/{clip-provider 228, clip-worker 218, dominant-colors 181, lab-color 148}` (CLIP) | rank/semantic-rank/lab-color/dominant-colors portable candidates |
| Filmstrips / waveforms | `S/features/timeline/services/{filmstrip-cache 0?,filmstrip-storage,filmstrip-cache-config,waveform-cache,waveform-opfs-storage,waveform-worker,sized-accessed-memory-cache}.ts`, `workers/filmstrip-extraction-worker.ts`, `hooks/use-filmstrip.ts`, `use-waveform*.ts` | OPFS-coupled; sized-accessed-memory-cache portable |
| Proxies | `S/features/media-library/services/proxy-service.ts` (1120), `workers/proxy-generation-worker.ts`, `proxy-constants.ts`, `utils/proxy-key.ts`; `S/features/preview/utils/scrub-proxy-fallback.ts` | coupled |
| Relinking / offline | `S/runtime/composition-runtime/components/media-offline-placeholder.tsx` (i18n "relink"), `utils/broken-media.ts` (22), `workspace-health.ts` (84), `S/shared/state/project-media-match-dialog`, `S/features/timeline/utils/external-file-project-match.ts`; no dedicated "relink service" found by name | partial |
| Caching | `media-library/utils/content-hash.ts` (18), `S/infrastructure/storage/cache-version.ts` (64), `workspace-fs/cache-mirror.ts`, `thumbnails.ts`, `waveforms.ts`, `decoded-preview-audio.ts`, `S/shared/utils/local-model-cache.ts`, `onnx-model-cache.ts`, `runtime/renderer/reverse-video-frame-cache.ts` | |
| Local transcription | `S/features/media-library/services/media-transcription-service.ts` (984), `transcription/{transcription-engine,browser-transcriber 330,browser-whisper-adapter,registry,types}.ts`, `transcription/workers/`, `lib/`; engines 'whisper' and 'parakeet' (types.ts L8); models `S/shared/utils/browser-whisper-models.ts`, `whisper-settings.ts` | transformers.js/onnxruntime-web, WebGPU |
| Captions | `media-library/utils/caption-items.ts` (1190), `S/shared/utils/subtitles.ts` (180), `subtitle-cue-format.ts`, `matroska-subtitles.ts`, `subtitle-sidecar-service.ts` (272), `S/shared/typography/caption-style-presets.ts`, `S/features/export/utils/export-subtitles.ts` (56), `runtime/renderer/embedded-subtitle-export.ts`; `workspace-fs/captions.ts` (655) | subtitles.ts/subtitle-cue-format/matroska-subtitles portable |
| Local TTS | `S/features/editor/services/{kokoro-tts-service 570, moss-tts-service 561, supertonic-tts-service 951}.ts`, `tts-generate-*.ts`; `public/moss-tts/*` (vendored worker + onnx host) | kokoro-js (WebGPU) |
| Local music gen | `S/features/editor/services/musicgen-service.ts` (382), `S/shared/utils/musicgen-models.ts` (Xenova/musicgen-small ...) | transformers.js |
| Other AI | frame interpolation (RIFE) `S/infrastructure/interpolation/*` + `frame-interpolation-service.ts` (328); Anime4K upscaler `S/infrastructure/upscale/anime4k-upscaler.ts` (164) + 3 bundled .onnx | |
| ProRes decode | `@mediabunny/prores`, `S/infrastructure/browser/prores-*.ts`, `S/runtime/composition-runtime/components/prores-preview-canvas.tsx` | |

## 6. Audio
| Feature | Files (lines) | Notes |
|---|---|---|
| Volume | `S/features/timeline/utils/audio-volume.ts` (71), `S/shared/state/mixer-live-gain.ts` | |
| Fades | `S/shared/utils/audio-fade-curve.ts` (+test), `utils/audio-fade.ts` (51), `utils/audio-fade-curve.ts` (142), `S/runtime/renderer/audio/clip-fades.ts` (63) | portable |
| EQ (6-band) | `S/shared/utils/audio-eq.ts` (1673; types `AudioEqBand1Type`..`AudioEqBand6Type`, per-band enabled/type/freq/gain/Q; imports `@/types/audio`); UI `.../clip-panel/audio-eq-panel-values.ts` | **Portable** (biquad coefficients + response); large |
| Pitch shift | `S/shared/utils/audio-pitch.ts` (63), `S/infrastructure/audio/time-stretch.ts` (672, SoundTouch LGPL), `S/runtime/composition-runtime/worklets/soundtouch-preview-processor.worklet.ts`, `components/{pitch-corrected-audio,soundtouch-worklet-audio}.tsx`, `utils/soundtouch-preview-*.ts` | LGPL caveat |
| Meters | `S/infrastructure/audio/mic-recorder/meter.ts` (61), `S/shared/state/audio-skim-meter.ts`, `S/features/preview/components/monitor-volume-control.tsx` | |
| Mixdown / ducking / DSP (export) | `S/runtime/renderer/audio/{mixdown 163, dsp 376, ducking 207, planning 484, transitions 510, windowed 436, nested-composition 454, pipeline 296, decode 354}.ts` | export-side; coupled to renderer types |
| Silence detection | `S/shared/utils/audio-silence.ts` (289, no imports), `S/features/timeline/workers/silence-detection-worker.ts` | **Portable** |
| Sync / preview-export consistency | `S/runtime/renderer/canvas-audio.ts`, `S/features/preview/utils/source-media-sync.ts`, `S/runtime/player/clock/Clock.ts` (641), dom-video drift test `runtime/renderer/dom-video-drift.test.ts`; script `test:preview-sync` (video-preview.sync.test.tsx) | Own clock; coupled |
| UI sounds / mic | `S/infrastructure/audio/ui-sound/*`, `mic-recorder/*`, `features/timeline/services/mic-recording-controller.ts` | |

## 7. Other
| Feature | Files | Notes |
|---|---|---|
| Lottie editing | `S/infrastructure/lottie/{lottie-metadata 418, lottie-frame-provider 398, lottie-color 336, lottie-text 246, lottie-slots 91, lottie-json 16}.ts`; `S/runtime/composition-runtime/components/lottie-player/`; browser `S/features/lottie-browser/` (lottiefiles-api.ts, panel, store); dep `@lottiefiles/dotlottie-web` 0.76.0 | lottie-color/metadata/text/slots are JSON-manipulation candidates (imports not checked) |
| Color scopes | `S/infrastructure/gpu-scopes/{waveform-scope 479, vectorscope-scope 343, histogram-scope 334, scope-renderer 143, scope-render-pass 88}.ts` (WGSL), UI `S/features/preview/components/color-scopes-{view 1161,panel,monitor,overlays}.tsx`, `color-scope-overlay-data.ts` | WebGPU-coupled |
| Project storage/recovery | workspace dir via File System Access: `S/infrastructure/storage/workspace-fs/*` (paths 505, projects 337, trash 263, fs-primitives 399, bootstrap 242, orphan-sweep 68, migrate-workspace-v2 425), legacy IDB migration `legacy-idb/migrate.ts` (506), `handles-db.ts`; `S/features/projects/services/project-upgrade-service.ts`, `S/shared/projects/migrations`; `headless/project-create-recovery.test.mjs`. No explicit crash-recovery/autosave module found by name (grep "recover|autosave" hits storage only). | Not portable (FSA/OPFS) |
| Import | media: mediabunny (mp4, mov, webm, mkv, mp3, wav, aac, ac3, prores, gif via gifuct-js), embedded/sidecar subtitles; project JSON `S/features/project-bundle/services/{json-import,bundle-import}-service.ts`, zod schema `schemas/project-schema.ts` | |
| Export | containers `S/types/export.ts` L10-11: video mp4/mov/webm/mkv; audio mp3/aac/wav. Codecs H.264/H.265/VP8/VP9/AV1 (+ProRes encoder pkg, AC3, AAC, MP3 encoder pkgs). Files: `S/runtime/renderer/client-render-engine.ts` (2639), `client-renderer.ts` (428), `render-pipeline.ts` (304), `packet-remux-plan.ts` (smart copy), `S/features/export/utils/{export-options 216, export-preflight 530, timeline-to-composition 590, smart-copy 374, build-render-job 241}.ts`, render queue store; bundle export `bundle-export-service.ts` | Not portable (WebCodecs/GPU) |
| Headless/agent API | `headless/*.mjs` (render, frame, edit, serve, agent) + `S/headless/edit.ts` — Playwright/Chrome driving the app; `package.json` scripts `headless*` | |

## 8. Licences of deps (from package.json; no node_modules present, licences below are NOT verified from the repo = "from memory / unknown")
- FreeCut: MIT. SoundTouch JS: LGPL-2.1+ (file-level). Anime4K/websr: MIT.
- Declared deps, typical licences (unverified): react, zustand, zod, radix, tanstack, motion, idb, clsx, tailwind: MIT; mediabunny + @mediabunny/*: MPL-2.0 (unverified; AAC/AC3/MP3 encoders may carry codec-related terms -> **check**); @huggingface/transformers, onnxruntime-web, kokoro-js, @lottiefiles/dotlottie-web, i18next: Apache-2.0/MIT (unverified). Model weights (Whisper, Parakeet, CLIP, LFM, Gemma, musicgen (CC-BY-NC for Meta MusicGen weights!), Kokoro, MOSS-TTS, RIFE) each have their own licences — unknown here, must be checked on Hugging Face before shipping.
- `public/moss-tts/vendor` licence: not inspected.

## 9. Hard platform requirements
- WebGPU (effects, compositing, transitions, masks, scopes, glyph-atlas text, AI accel), WebCodecs (preview + export), OPFS, File System Access API, Web Workers, AudioWorklet. README L182-185: "Chrome or Edge 113+ ... modern Chromium required".
- COOP/COEP headers: `vite.config.ts` L112-122, `vercel.json` L39-43 => SharedArrayBuffer/cross-origin isolation (needed for onnxruntime-web threads/WASM; also forces all cross-origin assets to supply CORP).
- Service worker `public/sw.js`, PWA manifest.
- Node 22+, npm 11+ for dev.

## 10. Version compatibility vs target (React 19.2.7, Vite 5, Remotion 4.0.540)
- React: FreeCut pins 19.2.5, uses hooks/`@testing-library/react` 16 — compatible with 19.2.7 (patch level).
- Vite: FreeCut builds with `vite-plus` / VoidZero rolldown-based Vite core (`vite` override). Config at `vite.config.ts` (not a Vite 5 config). Copied TS modules are bundler-agnostic; any `?worker`/`new URL(..., import.meta.url)` worker imports are Vite-feature dependent (Vite 5 supports both). Tailwind 4 + `@tailwindcss/vite` 4.2.2 needs Vite >=5.2 (ok-ish) but UI CSS/theme.css assumes Tailwind v4.
- TypeScript 7.0.2 (native compiler) — target TS version may reject some syntax? unlikely; check.
- Remotion: **not used**; FreeCut has its own Player/Clock/renderer (`S/runtime/player`, `composition-runtime`). Nothing to reconcile at dependency level, but its composition model (`TimelineItem` types in `S/types/timeline.ts` 507 l, items/tracks/keyframes) is not Remotion-shaped; adoption into Remotion requires mapping evaluators (frame-based pure functions) into `useCurrentFrame()`-driven components, and WGSL effects cannot run in Remotion's headless render unless WebGPU is available in the render browser (Remotion's Chrome headless often lacks WebGPU).
- Alias convention `@/` = `src/` (tsconfig paths) used everywhere; pure modules import `@/types/*`, so copying requires bringing along `S/types/{keyframe,timeline,transform,effects,motion,text-motion,audio,transition}.ts`.
- `check:boundaries` scripts enforce feature-to-feature imports through `deps/*` contract files (e.g. `S/features/keyframes/deps/*`) — this makes feature dirs somewhat extractable but pure utils still sit beside coupled ones.

## 11. Ranked shortlist: 15 most reusable pure-logic modules
(zero or types-only imports; all MIT unless noted; line counts above)
1. `S/shared/utils/easing.ts` (123) + `S/features/keyframes/utils/easing-presets.ts` (182) + `animation-easing.ts` (46): bezier/spring/preset easing — needs `S/types/keyframe.ts`.
2. `S/features/keyframes/utils/interpolation.ts` (92): keyframe interpolation.
3. `S/shared/utils/time-utils.ts` (132): timecode/frames/duration formatting, zero imports.
4. `S/features/keyframes/utils/motion-modifier-eval.ts` (393) + `motion-generator.ts` (137) + `motion-modulators.ts` (56) + `S/types/motion.ts`: procedural drift/sway/breathing/spin/shake.
5. `S/shared/typography/text-motion/{evaluate,segment-units,text-motion-presets}.ts` (~910 total) + `S/types/text-motion.ts`: per-char/word/line motion.
6. `S/shared/utils/audio-eq.ts` (1673) + `S/types/audio.ts`: 6-band parametric EQ coefficients.
7. `S/shared/utils/curve-spline.ts` (135) + `gpu-curves.ts` (353): monotone curve LUTs.
8. `S/features/timeline/utils/source-calculations.ts` (315) + `slip-utils.ts` (33) + `slide-utils.ts` (42) + `clip-utils.ts` (56): source/speed/slip/slide math.
9. `S/features/timeline/utils/in-out-points.ts` (82) + `S/shared/timeline/io-range/io-range-geometry.ts` (63): mark in/out.
10. `S/features/timeline/utils/timeline-snap-utils.ts` (306) + `razor-snap.ts` (90): snapping.
11. `S/shared/utils/audio-silence.ts` (289): silence detection (also feeds silence-removal).
12. `S/infrastructure/gpu-effects/lut/cube-lut.ts` (267): .cube LUT parser/3D texture data.
13. `S/features/keyframes/utils/color-keyframes.ts` (242), `property-expression.ts` (379), `vector-interpolation.ts` (251), `animated-crop-resolver.ts` (100): animated color/crop/expressions.
14. `S/infrastructure/analysis/adaptive-scene-detector.ts` (257) + `histogram-scene-detection.ts` (159) + `scene-detection-utils.ts`: scene cut logic (the latter imports logger/worker bits).
15. `S/shared/utils/{subtitles,subtitle-cue-format,matroska-subtitles}.ts` (180+...): SRT/VTT/MKV subtitle parsing; also `S/features/timeline/utils/audio-fade-curve.ts` + `S/shared/utils/audio-fade-curve.ts`.

### Not portable (coupled)
All `S/infrastructure/gpu-*` pipelines (need WebGPU device/pipeline framework; but WGSL strings in `gpu-effects/effects/*.ts` and `gpu-shared/blend-modes.ts` can be lifted into another WebGPU host), `S/runtime/**` (player/clock/renderer/composition-runtime), `S/features/timeline/stores/**` (zustand + snapshot undo), all `*-overlay.tsx`/gizmo/editor UI, `S/infrastructure/storage/**` (FSA/OPFS), transcription/TTS/musicgen services (transformers.js + workers + model caches), export pipeline.

## 12. Unverified / gaps
- Did not read function bodies; portability judged from import lists. Not checked: imports of composition-graph.ts, mask-path-utils.ts, transform-calculations.ts, lottie-*.ts, rank.ts.
- Drop-frame timecode, dedicated "relink" service, explicit crash-recovery/autosave: not found.
- `S/features/timeline/services/filmstrip-cache.ts` line count was not captured.
- Dependency licences (esp. mediabunny, MusicGen weights, VLM weights) are not confirmed from source.
