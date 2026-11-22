# Stage 4 report: audio, scene analysis, performance (CineGen, `#/timeline`)

Branch `claude/focused-brown-9xfv3c-stage4`, on top of Stage 1 (`e77a71d63`). Scope: CineGen only. No new dependency, no paid service, no model download added.
Entry point for everything new: the **Media tools** button at the bottom right of the Edit tab (tabs **Audio**, **Scenes**, **Media health**).

## Status per feature

| Feature | Status | Where / how |
|---|---|---|
| Clip volume, track volume | Already existed (Stage 1 mapped track volume/mute/solo). Not redone. | Clip properties, track header |
| Audio fades (clip fade in / out) | Already existed in preview (`interpolateProperty`) and export (`fadeIn`/`fadeOut` -> `fadedVolume`). Verified through the real mapping (test), not redone. | Clip properties |
| **Master volume** | Done, preview and export | Media tools > Audio > Master volume (0 to 100 %). `Timeline.masterVolume`. Preview: one master `GainNode`. Export: `buildExportState({ masterVolume })` multiplies every clip volume (and volume keyframes). Persisted: JSON path (field), DB path (`master_volume` timeline column). |
| **6-band parametric EQ** | Done, preview and export (baked) | Media tools > Audio > Equalizer for the selected clip (a selected video clip edits its linked audio clip). Preview: `BiquadFilterNode` chain per media element. Export: the EQ'd sound is rendered with an `OfflineAudioContext` into a WAV blob and the export clip points at it (blob URLs already travel to the sandboxed renderer as Blobs). Presets: Flat, Voice clarity, Podcast, Warmth, Bass boost, De-mud, Telephone. Response curve drawn live. |
| Stereo level meters | Done | Media tools > Audio > Meters (`AnalyserNode` L/R on the master output, peak hold, dBFS). |
| Audio sync check / offset | Already existed (Analyze > "Sync audio to ...", OpenChatCut cross-correlation). Not duplicated; recovery of a known offset is now covered by a test on synthetic audio. | Clip inspector > Analyze |
| Silence detection | Already existed (Analyze > "Find quiet spans", "Find silences (speech-aware)"). FreeCut `audio-silence.ts` NOT adopted (it would duplicate the vendored OpenChatCut core). Tested on synthetic audio. | Clip inspector > Analyze |
| **Scene-change detection** | Done (new, histogram based) alongside the existing mean-pixel "Detect scenes" button | Media tools > Scenes > Detect scenes (sensitivity slider, cancellable). Cuts are refined by bisection to about one frame. |
| **Scene browser** | Done | Scenes tab: thumbnail cards, editable name and tags, search (`words`, `tag:x`, time `0:12`, length `>3`), frame inspector (previous / next frame at the clip's real fps, scrub), "Add to timeline" (uses the editor's `addClipToTrack`, then trims to the scene). Scenes + thumbnails are cached in IndexedDB per media fingerprint. |
| Fast scrub thumbnails / filmstrip | Already existed (`filmstrip.ts`, filmstrip background, waveform). Not duplicated. | Timeline clips |
| **Proxy generation** | Done (re-wired by replacement), cancellable | The orphaned `src/lib/editor/proxyGenerator.js` (canvas + MediaRecorder: real-time, uncancellable, no importer) is left untouched and unused. CineGen's web adapter already made proxies with mediabunny but only on auto-fallback and without cancel; that code now lives in `lib/perf/proxy-job.ts` (AbortSignal, progress). Media health > Make proxy / Cancel proxy; `electronAPI.media.cancelProcessing`. |
| **Adaptive preview quality** | Done (policy + toggle) | Media health > "Adaptive": while playing, a frame-pacing monitor switches the engine's proxy mode to `on` after sustained dropped frames and back to `off` when smooth. |
| **Thumbnail caching in IndexedDB** | Done for scene thumbnails and scene metadata (idb-keyval, LRU prune, memory fallback). The existing filmstrip / thumbnail data in assets is unchanged. | `lib/perf/thumb-cache.ts` |
| **Media relinking UI** | Done | Media health > Check media (reads each source), Relink missing... / per-asset Relink... (file picker, matching by name / extension / size / duration, one-to-one). Relinked files are session blob URLs (browser limitation: no persistent file paths). |
| **Browser capability checks** | Done, one place | Media health > Browser capabilities: WebCodecs, WebGL2, OPFS, AudioWorklet, Web Audio (live + offline), IndexedDB, Workers/OffscreenCanvas, cross-origin isolation, WebGPU, Media Capabilities (decode probes), device. |
| **Cancellation of long jobs** | Done | `lib/perf/jobs.ts` registry (AbortController per job); scene scan, proxy, EQ bake accept an `AbortSignal`; running jobs listed with Cancel in Media health. |
| Pitch shifting | **Skipped by decision.** FreeCut's `time-stretch.ts` is SoundTouch, LGPL-2.1+; nothing was copied. | n/a |
| Local AI (transcription models, TTS, music generation) | **Not authorized; nothing added.** Evaluation only, below. | n/a |

## Fixes made on the way (preview/export parity)
- **Double sound in export (found while testing the EQ bake, pre-existing):** a video clip plus its linked audio clip both played the same audio in the export (video layer volume 1 + audio item volume 1), while the preview plays it once (video elements are muted; their sound comes from the linked audio-track clip). `buildExportState` now sets the video clip's own volume to 0 when it has a linked audio-track clip (and drops a hidden video's duplicate audio item). A video clip with no linked audio keeps its own sound (unchanged). This changes the audio of existing exports of imported videos (it removes the doubled signal); covered by tests.
- Master volume has no >100 % boost (the composition clamps volume to 1, as for clip volume).

## Export-of-EQ: what is and is not baked
- Baked: EQ on a clip whose sound is exported as an audio item (audio-track clips, which is where the UI puts the EQ, including the linked audio of a video). Cached per (source, EQ). A bake failure keeps the clip without EQ and puts a warning in the render panel (`job.warnings`). Sources longer than 20 minutes are not baked (warning).
- Not baked: EQ on a video clip with no linked audio (warned as preview-only; the UI does not offer it).
- Cost: the whole source file is decoded and re-encoded as 16-bit WAV per EQ'd clip (a long source means memory and time; trim happens afterwards in the composition).

## Upstream reuse and licences
- FreeCut (MIT, Copyright (c) 2025 FreeCut, commit `5ceeeb388eef5423640b7db157706274bf1b8165`): `src/shared/utils/audio-eq.ts`, the peaking / notch / shelf biquad formulas, the +-20 dB gain and 0.3 to 10.3 Q clamps, the preset idea; adapted (not copied wholesale) into `lib/audio/eq.ts` with an attribution header. The 1673-line resolver was not taken (depends on FreeCut's type files and a 7-pass stage model). `audio-silence.ts` and the scene detectors were not used (see above; the histogram detector is a generic approach, no FreeCut source copied).
- NOT used: `src/infrastructure/audio/time-stretch.ts` (LGPL).
- OpenChatCut (AGPL, vendored earlier): `scene/detect.ts` normalisation and `audio/silence.ts`, `multicam/align.ts` are reused as is.
- mediabunny (already a dependency) for proxies and fps detection; idb-keyval (already a dependency) for the cache.

## Files
New: `src/cinegen/lib/audio/{eq,meter,audio-graph,eq-bake,export-audio,export-prepare}.ts`, `lib/scenes/{histogram-cuts,scenes,scan-video,scene-timeline}.ts`, `lib/perf/{capabilities,thumb-cache,relink,adaptive-quality,jobs,proxy-job}.ts`, `components/edit/stage4/{stage4-dock,audio-panel,scenes-panel,media-health,ui}`, `__tests__/stage4/{audio,scenes-perf}.test.ts`, `docs/stage-4/smoke/*`.
Modified (small, additive): `lib/editor/playback-engine.ts` (+14 lines: fx graph hooks; parity budget 63/80), `lib/editor/export-mapping.ts` (master volume, eq pass-through, linked-audio rule), `types/timeline.ts` (`Clip.eq`, `Timeline.masterVolume`), `lib/db-converters.ts` (`stage4_json`, `master_volume`), `components/workspace/workspace-shell.tsx` (+1 line: save `master_volume`), `components/edit/edit-tab.tsx` (+3 lines; parity 245/260), `components/export/export-tab.tsx` (+1 line), `adapters/web-api.ts` (export goes through `buildExportStateWithAudio`), `adapters/web-media.ts` (cancellable proxy, `cancelProcessing`), `electron.d.ts`, `lib/help/help-content.ts` (help for the new controls; a test requires it).
Not touched: `timeline-editor.tsx` (still 224/220, the baseline parity failure), keyframe / transition / text-animation code, `proxyGenerator.js`.

## Tests actually run
- `npx vitest run src/cinegen`: baseline (Stage 1 final) 1 failed, 1420 passed, 27 skipped. After: **1 failed | 1458 passed | 27 skipped (1486)**; the one failure is the unchanged `timeline-editor.tsx` parity budget (224 > 220). +38 passing tests: `audio.test.ts` 16, `scenes-perf.test.ts` 22 (a first full run also failed `help-coverage` until the new controls got help entries; fixed).
- Real-data unit tests: EQ coefficients (hand-computed 6 dB / Q 1 peaking values, analytic centre / shelf / Butterworth -3.01 dB / notch values, Web Audio highpass Q in dB), WAV header and samples, meter maths, **master volume / fades / EQ bake through the REAL `buildExportState` + REAL `timelineToComposition`**, scene detection on synthetic frame sequences (3 known cuts found; moving object, slow fade, one-frame flash are not cuts; bisection refinement to 1/30 s), scene search / frame step / placement via the real `addClipToTrack`, silence detection and sync-offset recovery on synthetic audio, relink matching, capability detector with mocked globals (full / empty / partial / throwing), thumbnail cache (hit, LRU, IndexedDB-failure fallback), adaptive quality, job cancellation.
- ESLint on all changed and new files: 0 errors (warnings are the usual unused-parameter warnings on type signatures).
- Scoped `tsc` (alias-aware) over the new modules plus the edited engine / edit-tab / adapters: no new errors compared with the same files before (pre-existing errors only).
- Real browser (Playwright, Chromium 153 headless, vite dev server) `docs/stage-4/smoke/stage4-lib-browser.cjs`, all PASS: scene detection on a **real ffmpeg-made mp4 with 3 hard cuts** (4 scenes, cut times 2.000 / 4.400 / 6.000 s vs truth 2.0 / 4.4 / 6.0, JPEG thumbnails, 1.7 s for the 8 s clip, cancel = AbortError); EQ response equals `BiquadFilterNode.getFrequencyResponse` for 7 band types (max difference < 0.0001 dB); **EQ bake in a real `OfflineAudioContext`**: a 5 kHz component of a two-tone WAV is reduced by 12.00 dB, the 200 Hz tone by 0.01 dB, cached, flat EQ returns the source; meters on a real `AudioContext` graph: 0.5 sine = -6.02 dBFS on both channels, master 0.5 = -6.02 dB, live EQ -12 dB at 1 kHz = -12.00 dB, removal restores; IndexedDB cache persists across cache instances; capability report; proxy generation (mediabunny/WebCodecs) produced an MP4 and cancels.
- Real browser, UI path `stage4-ui-smoke.cjs` (real `#/timeline`, imported mp4), all PASS: scene browser shows 4 scenes with thumbnails; tag search and time search; frame inspector steps one frame at the clip's real 25 fps (the import records a fixed 30); Add to timeline places video + linked audio; EQ preset sets band gains and draws the curve; master volume; **meters move during real playback** (and read 1.1 dB lower with the Voice clarity EQ on than without, i.e. the EQ is audible in the preview); capability list (11 rows); Check media; Make proxy attaches a proxy ("Has proxy"); a proxy cancelled right after start leaves no proxy.

## NOT verified
- **A real Remotion web export with audio** (master volume, fades, EQ-baked WAV, the double-sound fix) was not run in a browser. Verified at the composition-model level (the props `renderMediaOnWeb` receives) and the bake itself in a real OfflineAudioContext. That the sandboxed renderer decodes the blob: WAV was not tested.
- Relink: the matching and the missing-source probe are tested; the file picker flow (relink a deleted source and see it play again) was not clicked through.
- Adaptive quality: the policy is unit tested; switching the engine under real dropped frames was not observed.
- Hover-help popups for the new controls (only the coverage test).
- Master volume persistence through a real DB save / reload (converters and column added, round trip not run).
- Browsers other than Chromium 153 headless; no real GPU; no Firefox / Safari. The headless Chromium here has WebCodecs, WebGL2, OPFS, WebGPU objects but no cross-origin isolation.
- Audio decode of the EQ bake for a source over 20 min (refused by design), large-file memory use.

## Browser support notes
- Needs Web Audio (all), `OfflineAudioContext` (EQ bake), IndexedDB (cache; memory fallback), WebCodecs for proxies (Chromium; Safari partial; Firefox recent). Scene scan and filmstrips only need `<video>` + canvas. Relink needs `<input type=file>` only. The capability panel shows what the current browser lacks. Scene scanning runs on the main thread (yields between frames) because decoding a video in a worker needs WebCodecs; a worker version is a possible later step.
- A relinked file is a session blob URL, not a persistent path (OPFS / File System Access persistence would be the next step).
- Multi-threaded ffmpeg.wasm is not used (it is not a dependency of CineGen; `@ffmpeg/*` stays unused by this stage), so cross-origin isolation is reported but not required.

## Local-AI evaluation (nothing added)
From FreeCut at the pinned commit (`src/shared/utils/{browser-whisper-models,musicgen-models,tts-settings}.ts`, `package.json`), licences marked unverified unless the Stage 0 appendix confirmed them:
- Transcription: Whisper base / small / large and NVIDIA Parakeet TDT v3 run via transformers.js / onnxruntime-web. Whisper weights are MIT (OpenAI), Parakeet is CC-BY-4.0 as far as known (unverified here); sizes range from tens of MB (quantized base) to GB (large) and are not measured. CineGen already ships a Whisper in-browser path (`transcribeInBrowser`, downloads on use) and Beat This / CLAP, so a second engine adds little.
- TTS: `kokoro-js` (Kokoro, Apache-2.0, unverified) and vendored MOSS-TTS (licence unknown per the Stage 0 appendix). CineGen already has cloud TTS providers.
- Music generation: `Xenova/musicgen-small`; Meta's MusicGen weights are CC-BY-NC, which is not usable in a commercial product (Stage 0 appendix).
- Recommendation: do not add any without a separate decision covering download size, licence, WebGPU / WASM performance, and storage (OPFS quota). Re-check licences on the model cards at that time.
