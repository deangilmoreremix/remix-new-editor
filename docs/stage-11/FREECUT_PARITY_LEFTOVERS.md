# FreeCut parity: what is left (Stage 11)

Upstream: `walterlow/freecut`, commit `5ceeeb388eef5423640b7db157706274bf1b8165` (MIT, except `src/infrastructure/audio/time-stretch.ts`, SoundTouch LGPL-2.1+).
Source of the feature list: `docs/stage-0/appendix-freecut.md`. States come from the stage reports (`docs/stage-1` to `docs/stage-10`), re-checked against the code in this worktree where a claim could be checked cheaply (grep of the GL registry, of `src/cinegen`, of the Remotion web renderer's container table). Paths are upstream paths (`S/` = `src/`).

State words: **done (stage N)** shipped and verified in that stage's report; **partial** shipped with a stated limit; **missing** not built (compatible, just not done); **incompatible** cannot or should not be brought over (reason given). "Stage 11 / port J" = this change. "Other agent" = in progress in a parallel worktree at the time of writing (portH pitch / time-stretch audio, portI1 local transcription / scene search / model manager, portI2 local TTS / music); this document does not claim their results.

Architecture rules that decide the "incompatible" rows: the CineGen editor, the Remotion web renderer and player, the project / media library and publishing stay; FreeCut's own player (`S/runtime/player`), renderer (`S/runtime/renderer`), `S/runtime/composition-runtime`, zustand stores and WebGPU-only pipeline are not brought in. FreeCut has no Remotion at all, so every "evaluator" is re-hosted as a frame/time function called from the existing composition.

## 1. Timeline editing

| FreeCut feature | Upstream paths | State in SmartVideo | Notes |
|---|---|---|---|
| Ripple edit, trim, split | `S/features/timeline/stores/actions/edit/{trim,split}-actions.ts`, `utils/trim-utils.ts`, `hooks/use-timeline-trim.ts` | done (existed before the port; Stage 1 added a cross-check test) | CineGen's own `timeline-operations.ts`; no upstream code used. |
| Rolling edit | `S/features/preview/components/rolling-edit-overlay*.tsx`, trim-actions | done (existed) | |
| Slip / slide | `utils/slip-utils.ts`, `slide-utils.ts`, `hooks/use-timeline-slip-slide.ts` | done (existed) | Duplicated CineGen's tested operations, so not adapted. |
| Linked audio / video | `utils/linked-items.ts`, `stores/actions/linked-edit.ts`, `S/shared/utils/linked-media.ts` | done (existed; Stage 1 grouping uses a separate `groupId`) | |
| Rate stretch | `stores/actions/edit/rate-stretch-actions.ts`, `hooks/use-rate-stretch.ts`, `utils/source-calculations.ts` | done (existed, Alt-drag edge, 0.1x to 8x) | |
| Speed ramp (stepped presets) | no direct upstream equivalent found in the audit | done (Stage 1, 4 presets) | |
| Speed ramp CURVE (bezier) | upstream has no speed curve; easing from `S/shared/utils/easing.ts` is reused through Stage 2 | **done (Stage 11 / port J)** | Curve over source position, per-segment easing from the Stage 2 curve editor; realised as exact harmonic-mean pieces. Limit: not re-editable after applying (no stored curve). |
| Freeze frame | `stores/actions/edit/freeze-frame-actions.ts` | missing, incompatible with the current engine | Needs a captured still (new image asset) or a per-clip freeze mode in `PlaybackEngine` and `TimelineComposition`. A speed of 0 is not supported (min 0.1x). |
| Join clips | `stores/actions/edit/join-actions.ts` | missing | Re-joining two halves of one split. Compatible; not built. |
| Range removal (lift / extract in-out range) | `stores/actions/edit/range-removal-actions.ts` (silence cutter), `sync-lock-ripple.ts` | **done (Stage 11 / port J)** as Lift and Extract of the timeline range | Own implementation on top of CineGen `splitClip`; locked tracks are skipped. Not done: sync-lock ripple across tracks, overlay-lane items, captions. |
| Silence removal, filler-word removal, transcript editing | `utils/silence-*`, `transcript-edit-model.ts`, `S/shared/utils/audio-silence.ts` | partial | Silence detection exists (OpenChatCut, Stage 4 tested). Dedicated filler-word removal and transcript-based editing are not built. Transcription itself is the portI1 area. |
| Source monitor | `S/features/preview/components/source-monitor.tsx`, `S/shared/state/source-player` | done (Clip Viewer existed, Stage 1 marks strip, Fix B persisted marks) | |
| Mark in / out, in-out range | `utils/in-out-points.ts`, `S/shared/timeline/io-range/*` | done (Stage 1 source marks; Fix B timeline range, loop, export range) | No range shading on the ruler (would touch `timeline-editor.tsx`). |
| Insert / overwrite edits | `stores/actions/source-edit-actions.ts`, `utils/source-edit-targeting.ts` | done (Stage 1) | No track-patching UI. |
| Markers | `stores/markers-store.ts`, `S/shared/timeline/marker-names.ts` | done (existed) | |
| Timecode display | `S/shared/utils/time-utils.ts` | partial | Existed but the frame field is fixed at 24 fps in `time-ruler.tsx`, whatever the project frame rate (Stage 1 limit). No drop-frame in FreeCut either. |
| Snapping | `utils/timeline-snap-utils.ts`, `utils/razor-snap.ts`, `hooks/use-snap-calculator.ts` | partial | CineGen snaps clip moves to other clip edges and the playhead, plus a half-second grid. Not present: snap to markers, to transition midpoints, razor shift-snap. The snap code lives in `timeline-editor.tsx` (parity budget), so a port would need a separate hook. |
| Track controls (mute / solo / lock / volume, heights) | `stores/actions/track-*.ts`, `utils/track-*.ts` | done (existed) | |
| Compound clips / sub-compositions | `stores/compositions-store.ts`, `composition-actions.ts`, `S/runtime/renderer/audio/nested-composition.ts` | partial (Stage 1) | One compound clip object, flattened for playback and export; own keyframes, fx, LUT, blend and captions of the compound are not applied (see Stage 1 limits; Fix E added group render for pictures). |
| Multiple sequences | `stores/sequences-store.ts` | done (existed, timeline tabs) | |
| Keyboard shortcut registry and editor | `S/config/hotkeys.ts`, `S/features/settings/components/hotkey-editor-sections.ts` | incompatible / not needed | CineGen has its own key handling and Stage 1 added J K L, I, O, Ctrl+G. A configurable registry is a different feature and was not requested. |
| Undo / redo | `stores/timeline-command-store.ts` | done (existed; snapshot model, same idea) | |
| Transitions | `S/shared/timeline/transitions/`, `S/infrastructure/gpu-transitions/` (WGSL) | done (Stage 6, GL transitions) | WGSL shaders are incompatible; equivalents come from 16 OpenChatCut transitions plus vendored gl-transitions shaders. |
| Classic / bento layouts | `utils/classic-tracks.ts`, `bento-layout.ts` | missing | Not in the product brief. |
| Crash recovery / autosave | none (the Stage 0 inventory found no module by name) | **done (Stage 11 / port J)**, original code | Not a FreeCut port. |

## 2. Animation and keyframes

| FreeCut feature | Upstream paths | State | Notes |
|---|---|---|---|
| Bezier graph editor (value graph) | `S/features/keyframes/components/value-graph-editor/*` | partial (Stage 2) | A per-segment curve editor popover (presets, bezier handles, spring). No multi-property value graph with pan / zoom. |
| Dopesheet | `.../dopesheet-editor/*` | partial (Stage 2) | Inspector dopesheet (rows, diamonds, drag to retime, delete). Not a full panel with box select or easing popovers per key. |
| Multi-property keyframes, auto-keyframe | `utils/animated-transform-resolver.ts`, `animatable-properties.ts`, `auto-keyframe.ts` | done (Stage 2) | `Clip.anim`; x y scale rotation opacity crop, effect parameters. |
| Interpolation, easing presets, custom bezier, spring | `S/shared/utils/easing.ts`, `utils/interpolation.ts`, `easing-presets.ts`, `S/types/keyframe.ts` | done (Stage 2, adapted with attribution) | |
| Property expressions, vector interpolation / promotion | `utils/property-expression.ts`, `vector-interpolation.ts`, `vector-promotion.ts` | missing | Pure TS, compatible; no user request. |
| Procedural motion (drift / sway / breathing / spin / shake) | `utils/motion-modifier-eval.ts`, `motion-generator.ts`, `motion-modulators.ts` | done (Stage 2, adapted) | |
| Motion presets library, bake motion to keys, trigger-wave | `utils/motion-presets.ts`, `bake-motion.ts`, `trigger-wave-motion-layer.ts` | missing | Compatible. |
| Animated crop, colour keyframes | `utils/animated-crop-resolver.ts`, `color-keyframes.ts` | done (crop Stage 2; colour via animated effect parameters 5b) | |
| Animated masks | `utils/path-animatable-properties.ts` | done (Fix C, pen-path mask with animated anchors / feather) | |
| Per character / word / line text motion | `S/shared/typography/text-motion/*` | done (Stage 2 char / word, Fix B line) for captions | Overlay text (`SmartText`) is CSS-animated and not per-unit. Idea only, FreeCut's evaluator is tied to its glyph atlas. |
| Curve tools (monotone spline) | `S/shared/utils/curve-spline.ts`, `gpu-curves.ts` | done (Fix C, adapted) | |
| Animation preset storage | `S/infrastructure/storage/workspace-fs/animation-presets.ts` | missing; storage part incompatible (File System Access) | A localStorage / IndexedDB version would be compatible. |

## 3. Effects (FreeCut: WebGPU / WGSL; SmartVideo: WebGL2 / GLSL in `src/openchatcut/gl/fx`)

WGSL shader code is not copied (different language and bind layout); effects were written in GLSL, with attribution where an algorithm was adapted.

| FreeCut effect(s) | Upstream | State | Notes |
|---|---|---|---|
| curves, gradient-map, vibrance, temperature (temp / tint), exposure, levels, color-wheels, sepia, invert | `S/infrastructure/gpu-effects/effects/color.ts` | done (existed or Stage 3 / 5) | Curves got a draggable editor in Fix C. |
| secondary-qualifier, power-window | same | done (as HSL qualify and rect / circle / pen-path masks) | Different UI, same capability class. |
| brightness, contrast, hue-shift, saturation, grayscale as separate effects | same | not individually checked | Not in the GL registry; whether the clip colour controls cover them was not re-verified here. |
| LUT (`.cube`) | `effects/lut.ts`, `lut/cube-lut.ts` | done (existed; user `.cube` import, intensity) | |
| gaussian / box / motion / radial / zoom blur | `effects/blur.ts` | done (soft blur, box blur, motion blur, radial blur incl. zoom / spin) | |
| pixelate, rgb-split, twirl, wave, bulge, kaleidoscope, mirror, ripple, fluted glass | `effects/distort.ts` | done (existed or Stage 3 / 5; fluted glass as "glass") | |
| trigger-wave, glass-mosaic, blocks, droste | same | missing | Compatible (single-pass GLSL). Low value. |
| vignette, grain, sharpen, posterize, glow, edge-detect, scanlines, crt, halftone, vhs, ink, ascii, glitch | `effects/stylize.ts` | done (existed or Stage 3 / 5; ink as sketch, glow as bloom, glitch for colour / block glitch) | |
| dither, threshold | same | missing | Compatible. |
| pixel-sort, pixel-sort-hq | same | done (Fix G, multi-pass fragment version, up to 64 passes) | No compute shader, so not identical to the high-quality compute variant. |
| chroma key + spill suppression | `effects/keying.ts` | done (existed) | |
| Blend modes | `S/types/blend-modes.ts`, `S/infrastructure/gpu-shared/blend-modes.ts` | done (existed, `lib/occ/blend`) | |
| Masks (pen path), corner pin | `mask-editor-overlay.tsx`, `utils/mask-path-utils.ts`, `corner-pin-overlay.tsx` | done (Fix C) | |
| Transform gizmos, shapes | `transform-gizmo.tsx`, `gizmo-overlay.tsx`, `S/infrastructure/gpu-shapes/*` | done / not applicable (CineGen has its own transform handles and overlay shapes) | |
| Colour scopes | `S/infrastructure/gpu-scopes/*` (WGSL) | done (existing scopes panel, RGB parade added in Stage 3) | WGSL code incompatible. |
| GPU compositor, effect presets, effect UI stores | `S/infrastructure/gpu-compositor`, `workspace-fs/effect-presets.ts` | incompatible | Part of FreeCut's own renderer / FS workspace. |

## 4. Media intelligence

| FreeCut feature | Upstream | State | Notes |
|---|---|---|---|
| Scene detection | `S/infrastructure/analysis/{scene-detection,histogram-scene-detection,adaptive-scene-detector}.ts` | done (Stage 4 histogram detector, Fix B worker scan) | Own implementation, FreeCut files not used. |
| Scene captioning / verification, semantic scene search, CLIP embeddings | `analysis/captioning/*`, `S/features/scene-browser/*`, `analysis/embeddings/*` | other agent (portI1) | Local VLM / CLIP models; model licences must be checked first. Stage 4 shipped a text / tag scene browser. |
| Filmstrips, waveforms, thumbnails | `features/timeline/services/{filmstrip,waveform}-*.ts` | done (existed; Stage 4 IndexedDB cache) | OPFS storage part of FreeCut is not used. |
| Proxies | `S/features/media-library/services/proxy-service.ts` | done (Stage 4, mediabunny, cancellable, adaptive quality) | |
| Relinking / offline media | `media-offline-placeholder.tsx`, `workspace-health.ts` | done (Stage 4 relink UI, Fix B persisted local media) | |
| Local transcription (Whisper / Parakeet) | `media-library/services/media-transcription-service.ts`, `transcription/*` | other agent (portI1) | CineGen already had an in-browser Whisper path before the port. |
| Captions, subtitle import / export | `media-library/utils/caption-items.ts`, `S/shared/utils/subtitles.ts`, `subtitle-cue-format.ts`, `matroska-subtitles.ts` | partial | CineGen has OpenChatCut captions and SRT export (existing tests). Matroska embedded subtitle read and sidecar matching not ported. |
| Local TTS, local music generation | `S/features/editor/services/{kokoro,moss,supertonic}-tts-service.ts`, `musicgen-service.ts` | other agent (portI2) | MusicGen weights are CC-BY-NC (Stage 0 appendix): a licence question, not a technical one. |
| Frame interpolation (RIFE), upscaler (Anime4K) | `S/infrastructure/interpolation/*`, `upscale/*` | missing, not requested | Large ONNX models; needs a separate licence / size decision. |
| ProRes decode | `@mediabunny/prores`, `S/infrastructure/browser/prores-*` | missing | Compatible only as a decode path inside mediabunny; not requested. |

## 5. Audio

| FreeCut feature | Upstream | State | Notes |
|---|---|---|---|
| Volume, fades | `utils/audio-volume.ts`, `audio-fade*.ts`, `S/runtime/renderer/audio/clip-fades.ts` | done (existed; Stage 4 verified) | |
| 6-band EQ | `S/shared/utils/audio-eq.ts` | done (Stage 4, formulas adapted; preview via biquads, export baked with OfflineAudioContext) | |
| Meters | `S/infrastructure/audio/mic-recorder/meter.ts` | done (Stage 4 master meters) | |
| Master volume | none specific | done (Stage 4) | |
| Mixdown, ducking, DSP, transitions in export | `S/runtime/renderer/audio/*` | incompatible (FreeCut renderer internals) | Export audio comes from the Remotion composition; EQ is baked per clip. Auto-ducking is missing. |
| Pitch shift, time-stretch | `S/shared/utils/audio-pitch.ts`, `S/infrastructure/audio/time-stretch.ts` (LGPL-2.1+) | other agent (portH) | Licence caveat for the SoundTouch file. |
| Silence detection | `S/shared/utils/audio-silence.ts` | done (OpenChatCut equivalent, Stage 4) | |
| Mic recording, UI sounds | `S/infrastructure/audio/mic-recorder/*`, `ui-sound/*` | partial | CineGen has voice recording in the media pool (Stage 9 notes persisted recordings). UI sounds not ported. |
| Audio-only export (WAV / MP3 / AAC) | `S/types/export.ts` (container list) | **done (Stage 11 / port J)** through the existing renderer | Also FLAC and Ogg (Opus), which the renderer writes. |

## 6. Other

| FreeCut feature | Upstream | State | Notes |
|---|---|---|---|
| Lottie colour and text edits | `S/infrastructure/lottie/{lottie-color,lottie-text,lottie-json}.ts` | done (Stage 2, adapted) | |
| Lottie value slots (scalar / vector), layer visibility | `S/infrastructure/lottie/lottie-slots.ts` (slots); layer visibility is not in FreeCut | **done (Stage 11 / port J)** | Slot discovery adapted from FreeCut; values are baked into the JSON (lottie-web and `@remotion/lottie` have no slot API). Layer visibility (Lottie `hd` flag) is original. Limits: an animated slot becomes static; only top-level layers; verified in the real lottie-web renderer, not rendered through `@remotion/lottie` in an export. | |
| Lottie markers, dotLottie archives / themes, metadata | `lottie-metadata.ts`, `lottie-frame-provider.ts`, `S/features/lottie-browser/*` | missing / incompatible | dotLottie needs the WASM `@lottiefiles/dotlottie-web` player, a second Lottie runtime next to lottie-web and `@remotion/lottie`. LottieFiles browser needs their API. |
| Project storage / recovery | `S/infrastructure/storage/workspace-fs/*` (File System Access, OPFS) | incompatible | CineGen projects live in IndexedDB / Supabase; crash recovery is Stage 11. |
| Project bundle import / export (zod schema) | `S/features/project-bundle/*` | missing | CineGen exports FCPXML (existing). |
| Media import formats | mediabunny (mp4 mov webm mkv mp3 wav aac ac3 prores gif) | partial | Imports go through the browser's own decoders and mediabunny where used; AC3 and ProRes not added. |
| Video containers: mp4, mov, webm, mkv | `S/types/export.ts`, `S/runtime/renderer/client-render-engine.ts` | **done (Stage 11 / port J)** (mp4 existed, mov / mkv / webm selectable, verified by a real export) | Codec set is H.264 / VP9 only in the picker; H.265 / AV1 exist in the renderer but are not offered. |
| Export engine (smart copy, render queue, preflight) | `S/runtime/renderer/*`, `S/features/export/utils/*` | incompatible | Replaced by the Remotion web renderer, by rule. |
| Headless / agent API | `headless/*.mjs`, `S/headless/edit.ts` | incompatible | Drives FreeCut's own app. SmartVideo has its own MCP bridge for CineGen (`src/cinegen/lib/mcp`). |
| PWA, service worker, COOP / COEP | `public/sw.js`, `vite.config.ts` L112-122 | incompatible | COOP / COEP would break cross-origin embeds the product relies on. |
| WebGPU-only requirement | whole `S/infrastructure/gpu-*` | incompatible | The product runs on WebGL2 and degrades gracefully without WebGPU. |

## 7. Not in the audit table but reviewed in Stage 11 for a user-visible gain

`razor-snap.ts`, `timeline-snap-utils.ts` (transition-aware edges), `grade-clipboard-ops.ts`, `effect-property-reset.ts`, `playhead-edge-scroll.ts`, `freeze-frame-actions.ts`, `join-actions.ts`. Only the range removal idea was taken (as Lift / Extract). The others either live in `timeline-editor.tsx` (over its parity budget as soon as touched) or need engine changes. See `docs/stage-11/PORT_J_REPORT.md`.

## 8. Compatible leftovers, roughly by value (not done in Stage 11)

1. Timecode that follows the project frame rate (needs the project fps passed to `time-ruler.tsx`, `timeline-viewer.tsx`, `source-viewer.tsx`; `timeline-editor.tsx` has call sites, so it must go through a shared module to stay inside the parity budget).
2. Snap to markers and transition midpoints, razor shift-snap (FreeCut `timeline-snap-utils.ts`, `razor-snap.ts`); same parity-budget constraint.
3. Join clips (re-merge a split), freeze frame (needs an engine decision), re-editable speed curves (store the curve on the pieces).
4. Matroska embedded subtitles and sidecar subtitle matching (`S/shared/utils/matroska-subtitles.ts`, `subtitle-sidecar-service.ts`).
5. Motion presets library and "bake motion to keyframes" (`motion-presets.ts`, `bake-motion.ts`).
6. A localStorage / IndexedDB version of animation and effect presets (`workspace-fs/animation-presets.ts`, `effect-presets.ts`).
7. Missing GLSL effects: dither, threshold, trigger-wave, glass-mosaic, blocks, droste.
8. Auto-ducking, sync-lock ripple across tracks.

Local AI (transcription, scene search, TTS, music generation, pitch / time-stretch) is being handled by the other agents named above and is deliberately not listed as leftover here.
