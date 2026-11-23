# Timeline Studio Editor — feature completion ledger

Generated from `docs/timeline-feature-ledger.json` by `scripts/ledger-check.mjs` (branch `ccr-c5b3c675-lgaduo`, OpenChatCut upstream `9242a95`).

**Never read PARTIAL / IMPLEMENTED_UNVERIFIED / BLOCKED as done.** Only VERIFIED rows have tests and evidence recorded.

## Regression record

- **vitest:** npx vitest run src netlify: 798 files passed, 9519 tests passed, 0 failed (42 skipped). Earlier the same run had 8 failures that also failed on a clean origin/develop; they are fixed here (Ask SmartVideo guides for zackd and video-pages, a Zack D test mock, and the two personalization discovery test files now stub DNS). src/cinegen: 215 files, 1510 tests passed
- **viteBuild:** npx vite build exit 0 (2m59s) at commit 8f53c484; npm run lint exit 0 (0 errors)
- **classicEditor:** #/timeline-classic now opens the CineGen editor (commit 642979f0); the old TimelineEditorPage.jsx is no longer reachable from the app
- **tsc:** not run: repo-wide tsc aborts on unrelated syntax errors in apps/director; a scoped check needs @cinegen path mapping (done once, not repeated)
- **liveProviders:** no live social, MailerLite, Kit, Supabase or Clerk calls (not available in the sandbox); covered by mocked clients and gate states
- **upstreamCineGenTests:** CineGen tests/ ported to src/cinegen/__tests__/upstream: 557 passed, 27 skipped (documented), 0 failed; EXCLUDED.md lists every skipped/removed test with its reason

## Totals

| Status | Count |
|---|---|
| NOT_STARTED | 1 |
| SOURCE_FOUND | 0 |
| PARTIAL | 23 |
| IMPLEMENTED_UNVERIFIED | 15 |
| VERIFIED | 24 |
| BLOCKED | 2 |
| NOT_APPLICABLE | 2 |
| **All** | 67 |

## Effects

### occ.fx.shader-effects — VERIFIED

- Source (0xsline/OpenChatCut): src/gl/fx/shaderEffects.ts, src/gl/fx/effects.ts, src/gl/fx/uniforms.ts
- Target: src/openchatcut/gl/fx/shaderEffects.ts, src/cinegen/components/edit/clip-effects-section.tsx, src/cinegen/components/edit/gl-clip-layer.tsx
- Original: 33 WebGL shader effects with prop schemas, stacking per clip
- Browser: WebGL2 · Backend: none
- UI: Edit → clip inspector Effects + Library modal (FxThumb) · Persistence: clip.fx JSON column · Preview: GlClipLayer over viewer video · Export: burned in via OccClipFx in Remotion composition
- Tests: vitest: gl.test.ts (fx.verify, chroma-key.verify), occ-clip-fx.test.ts
- Evidence: commits c2033b50, 4e19731c, 50400dcc; MP4 frame checks in session (no stored artefact)
- **Missing:** Keyframed effect params (their keyframeRegistry) not wired to CineGen keyframes; effect reorder UI absent (order = add order)

### occ.fx.lut-looks — VERIFIED

- Source (0xsline/OpenChatCut): src/gl/fx/lutEffects.ts, src/gl/fx/lut.frag.ts, assets/luts/*.cube
- Target: src/openchatcut/gl/fx/lutEffects.ts, public/luts/*.cube, src/cinegen/lib/occ/user-luts.ts
- Original: 16 looks/LUTs: 14 formula looks + 2 camera-log .cube; import .cube
- Browser: WebGL2 sampler3D · Backend: none
- UI: Effects → LUT / Look select, Library tab, Import .cube · Persistence: clip.lut + IndexedDB for imported cubes · Preview: GL layer · Export: burned in; imported cube text travels with render
- Tests: vitest cube.verify; occ-clip-fx
- Evidence: commit e5e4f9b7, c2033b50

## Transitions

### occ.transitions.glsl — PARTIAL

- Source (0xsline/OpenChatCut): src/gl/transitions.ts, src/gl/shaders/*.frag.ts, src/gl/GlTransition.tsx
- Target: src/openchatcut/gl/transitions.ts, src/openchatcut/gl/GlTransitionLayer.tsx, src/cinegen/components/edit/clip-transition-section.tsx
- Original: 16 GLSL transitions on cuts
- Browser: WebGL2 · Backend: none
- UI: Cut inspector section (picker + length) · Persistence: transition.glType (gl_type column) · Preview: GL transition layer in viewer (implemented; live preview in browser NOT verified) · Export: verified: GL transition export MP4 (commit 6c6b07a3 notes)
- Tests: vitest transitions in gl tests
- Evidence: session evidence (export frame)
- **Missing:** Live preview of the transition in a real browser tab not verified; direction/settings props not exposed

## Blend

### occ.blend — PARTIAL

- Source (0xsline/OpenChatCut): (no registry in source)
- Target: src/cinegen/lib/occ/blend.ts
- Original: Advertised 17 blend modes
- Browser: CSS mix-blend-mode · Backend: none
- UI: Effects → Blend select · Persistence: clip.blend_mode · Preview: CSS blend on GL canvas · Export: CSS mix-blend-mode in composition (commit 6c1ca460); frame check not recorded
- Tests: —
- Evidence: commit 6c1ca460
- **Missing:** OpenChatCut source contains NO blend-mode registry (only luma-blend transition + shader-local blends); the 17-mode list is CineGen/CSS standard modes, not upstream algorithms.
- **Blocker:** Upstream has no blend registry to port; advertised 17 not reproducible from source

## Plugins

### occ.plugins.system — VERIFIED

- Source (0xsline/OpenChatCut): src/plugins/{types,validate,install,store}.ts, src/library/pluginResources.ts, src/editor/customZooms.ts
- Target: src/openchatcut/plugins/*, src/cinegen/lib/occ/plugins.ts, src/cinegen/components/edit/occ-library-modal.tsx
- Original: openchatcut-plugin@1 packs: fx, LUT, transition, zoom, mg-template; validate, GLSL compile probe, install/uninstall/enable
- Browser: WebGL2 + IndexedDB · Backend: /api/plugins server (replaced by IndexedDB, their own offline path)
- UI: Edit → Browse library → Extensions tab (install file/URL, enable, remove); items appear in Effects/LUT/Transitions tabs and zoom select · Persistence: IndexedDB (openchatcut/kv) + per-clip/cut snapshots in project · Preview: applied fx previews via GL layer · Export: snapshots registered inside export runner (frame check: see evidence)
- Tests: vitest occ-plugins.test.ts (18 incl. hostile packs); browser plug1/plug2
- Evidence: docs/evidence/plugins/ (3 screenshots, demo-pack.json, plug-frame.png). Export: exported MP4 mean RGB 150,147,149 vs 107,107,109 un-effected control (invert fx) with the pack DISABLED at export time (snapshot path)
- **Missing:** mg-template items are skipped (their sandboxed template runtime is not part of the editor); pack-with-only-templates is rejected

### occ.templates.mg — PARTIAL

- Source (0xsline/OpenChatCut): src/template-host.ts, src/library/TemplateBrowser.tsx, assets/templates/*.json
- Target: —
- Original: Motion-graphics templates that run template code in a sandbox
- Browser: iframe sandbox (browser) · Backend: none
- UI: Edit → Library → Animations (motion graphics) and Add to timeline → Motion graphics; shown on the Overlays lane and in the viewer · Persistence: — · Preview: — · Export: —
- Tests: library-panel.test.tsx; browser run adding a template and seeing it in the viewer
- Evidence: docs/evidence/merge-check/20-left-library-tab.png, 24-add-to-timeline-menu.png, 81-everything-added-in-timeline.png; commits 24402eb7, 014616dc
- **Missing:** Their sandboxed template-pack runtime / .json pack import is not integrated; only the shipped templates are offered

## Zoom

### occ.zoom.presets — VERIFIED

- Source (0xsline/OpenChatCut): src/editor/zoom.ts, src/editor/customZooms.ts
- Target: src/openchatcut/editor/zoom.ts, src/cinegen/components/edit/clip-zoom-section.tsx
- Original: Zoom shapes + custom zoom envelopes
- Browser: canvas/CSS · Backend: none
- UI: Zoom select + amount/focus sliders; plugin zoom presets · Persistence: clip.zoom_json · Preview: CSS scale in viewer · Export: OccZoom in composition
- Tests: zoom in gl tests
- Evidence: commit a798c788
- **Missing:** Custom zoom paths (envelope editor) only via plugins

## Tracking

### occ.tracking.follow — PARTIAL

- Source (0xsline/OpenChatCut): src/tracking/{analyzeMotion,templateMatch,types}.ts
- Target: src/openchatcut/tracking/*, src/cinegen/components/edit/follow-subject-dialog.tsx, src/cinegen/lib/occ/follow-zoom.ts
- Original: Template-match tracker → zoom reframeCurve
- Browser: canvas · Backend: none
- UI: Zoom section → Follow subject dialog · Persistence: clip.zoom reframeCurve · Preview: preview follows subject · Export: export via OccZoom
- Tests: vitest tracking verify; browser run
- Evidence: commit a798c788
- **Missing:** Result drives the zoom focal point only; no position/scale/rotation transform on clip, so tracking cannot yet pin overlays/graphics

### occ.tracking.pin — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut): src/tracking/*, src/editor/keyframeActions (stabilize idea)
- Target: src/cinegen/components/edit/follow-subject-dialog.tsx (Pin subject button), src/cinegen/lib/occ/transform.ts (transformFromTrack)
- Original: Tracked subject pinned to frame centre via transform path
- Browser: canvas + CSS · Backend: none
- UI: Zoom → Follow subject → 'Pin subject to centre (transform)' · Persistence: clip.transform.path · Preview: same css as transform (verified) · Export: same OccTransform path (verified for static transform)
- Tests: transformFromTrack unit tests
- Evidence: this branch
- **Missing:** The Pin button itself was not driven in the browser; path keys verified only in unit tests; tracking cannot yet pin overlays/graphics

## Reframe

### occ.reframe.auto — PARTIAL

- Source (0xsline/OpenChatCut): src/reframe/detect.ts
- Target: src/openchatcut/reframe/detect.ts, src/cinegen/lib/occ/auto-reframe.ts, src/cinegen/components/edit/clip-zoom-section.tsx
- Original: Browser-native saliency/energy (+ optional FaceDetector) subject detection → reframe keyframes
- Browser: canvas, optional FaceDetector · Backend: none
- UI: Zoom → Auto-reframe (follow subject) · Persistence: clip.zoom reframeCurve · Preview: browser: on a moving-subject clip the zoom focal point moved 49.7% → 60.6% → 74.0% across the clip (docs/evidence/transform/rf-1-autoreframe.png) · Export: same OccZoom reframeCurve path as follow-subject (export verified for that path in an earlier stage); an export frame for auto-reframe itself was not captured
- Tests: occ-auto-reframe.test.ts (2); browser rf1
- Evidence: this branch
- **Missing:** Output canvas aspect (e.g. 9:16 vertical) is not selectable: the web export is fixed 16:9, so 'reframe to target aspect' is not possible yet — only subject-following zoom at a chosen magnification; no manual keyframe adjustment UI

## Multicam

### occ.multicam.align — VERIFIED

- Source (0xsline/OpenChatCut): src/multicam/align.ts
- Target: src/openchatcut/multicam/align.ts, src/cinegen/components/edit/clip-analyze-section.tsx
- Original: Audio cross-correlation alignment
- Browser: WebAudio · Backend: none
- UI: Analyze → Sync to clip · Persistence: timeline clip offsets · Preview: — · Export: —
- Tests: align.verify
- Evidence: commit c6ae0deb

### occ.multicam.switch — PARTIAL

- Source (0xsline/OpenChatCut): src/editor/camSwitch.ts, src/multicam/{groups,changeCam}.ts
- Target: src/openchatcut/editor/camSwitch.ts, src/cinegen/lib/occ/cam-switch.ts, src/cinegen/components/edit/clip-multicam-section.tsx
- Original: Camera switching: other cameras are split + removed in the switch interval (their planCamSwitch); persistent multicam groups/angle decisions
- Browser: pure TS · Backend: none
- UI: Inspector → Multicam → Cut to this camera (length slider from playhead) · Persistence: ordinary clip edits (SET_TIMELINE history) · Preview: timeline UI verified in browser (two tracks) · Export: exported MP4: t=2.7s red (top camera), 4.5s SMPTE bars (selected lower camera), 7.6s green (top camera tail) — docs/evidence/multicam/
- Tests: occ-cam-switch.test.ts (4); browser mc3
- Evidence: docs/evidence/multicam/ (mc-strip frames), this branch
- **Missing:** Their persistent multicam group / angle-decision model (groups.ts, changeCam.ts replaceAngleDecision) is not integrated: switching is a one-way destructive edit; undo/redo not separately tested; angles are not auto-grouped from audio sync

## Color

### occ.color.scopes-autograde — VERIFIED

- Source (0xsline/OpenChatCut): src/color/{scopes,autoGradeCore,autoGrade}.ts
- Target: src/openchatcut/color/*, src/cinegen/lib/occ/analysis.ts
- Original: Scopes stats + auto-grade (server ffprobe in original)
- Browser: canvas · Backend: /api/auto-grade replaced by canvas sampling
- UI: Analyze → scopes, Auto grade · Persistence: fx on clip · Preview: — · Export: burned in as fx
- Tests: scopes.verify
- Evidence: commit e2900891
- **Missing:** Algorithm difference: sampled canvas stats instead of ffprobe signalstats

## Video intelligence

### occ.scene-detect — VERIFIED

- Source (0xsline/OpenChatCut): src/scene-detection/detect.ts
- Target: src/openchatcut/scene/detect.ts, src/cinegen/lib/occ/analysis.ts
- Original: Scene cut detection (server FFmpeg scene filter in original)
- Browser: canvas · Backend: /api/detect-scenes replaced by histogram diff
- UI: Analyze → Detect scenes / Split · Persistence: markers + split clips · Preview: — · Export: —
- Tests: browser run
- Evidence: commit e2900891
- **Missing:** Browser histogram diff ≠ FFmpeg scene score; threshold normalisation reused

## Captions

### occ.captions.styles — VERIFIED

- Source (0xsline/OpenChatCut): src/captions/{styles,captionMotion,renderStyles,captionPages,CaptionsLayer}.ts*
- Target: src/openchatcut/captions/*, src/cinegen/components/edit/clip-captions-section.tsx, src/cinegen/components/edit/captions-preview-layer.tsx
- Original: 22 caption styles, 5 motion options, word pages, karaoke
- Browser: Remotion · Backend: none
- UI: Captions section: style, motion, brand style, font · Persistence: clip.captions_json · Preview: @remotion/player layer · Export: burned into MP4 (export frame verified)
- Tests: occ-caption-cues.test.ts
- Evidence: commits d4901164, 7fb4850f
- **Missing:** Caption timeline lane, group move, clipboard, preview editor, style drag, preset store NOT integrated

### occ.captions.cue-editor — VERIFIED

- Source (0xsline/OpenChatCut): src/captions/CaptionCueEditor.tsx, captionCues.ts
- Target: src/openchatcut/captions/CaptionCueEditor.tsx
- Original: Sentence-by-sentence editing
- Browser: DOM · Backend: none
- UI: Captions → Edit lines · Persistence: wordOverrides in captions JSON · Preview: preview text updated (browser) · Export: —
- Tests: occ-caption-cues.test.ts
- Evidence: commit 7fb4850f; screenshot cue-3-edited

### occ.captions.translate-srt — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut): src/captions/{translate,srt}.ts
- Target: src/cinegen/lib/occ/translate.ts
- Original: LLM translation + SRT
- Browser: fetch · Backend: OpenAI Responses (existing)
- UI: Captions → Add translation, SRT download · Persistence: captions.translation · Preview: — · Export: —
- Tests: occ-translate.test.ts
- Evidence: commit e5e4f9b7
- **Missing:** Live OpenAI translation not tested (no key in sandbox)

### occ.captions.srt-presets-fonts — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/captions/{srt,exportCaptions,presetStore}.ts
- Target: src/openchatcut/captions/*, src/cinegen/components/edit/clip-captions-section.tsx, src/cinegen/lib/occ/user-fonts.ts
- Original: SRT import/export, saved caption looks, user font import (carried into exports as data URLs)
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343)
- **Missing:** Not browser-run: SRT/preset/font UI and the font hand-off to the export runner; occ-caption-srt.test.ts covers the SRT round trip only

## Typography

### occ.captions.fonts — PARTIAL

- Source (0xsline/OpenChatCut): src/fonts/{googleFonts,googleFontCatalog,localFonts,projectFonts,systemFonts}.ts
- Target: src/openchatcut/fonts/{googleFontCatalog,localFonts,systemFonts}.ts
- Original: Google/bundled/system/project fonts
- Browser: FontFace · Backend: none
- UI: Caption Font select (30 Google families) · Persistence: styleOverride.fontFamily · Preview: — · Export: font name registered for export
- Tests: occ-design-presets.test.ts
- Evidence: commit 7fb4850f
- **Missing:** User font import, system fonts (queryLocalFonts), bundled CJK fonts not wired

## Design

### occ.design-presets — PARTIAL

- Source (0xsline/OpenChatCut): src/editor/design-presets.ts
- Target: src/openchatcut/editor/design-presets.ts, src/cinegen/lib/occ/design-style.ts
- Original: 24 brand colour/font presets
- Browser: pure · Backend: none
- UI: Captions → Brand style · Persistence: styleOverride · Preview: — · Export: —
- Tests: occ-design-presets.test.ts
- Evidence: commit 7fb4850f; screenshot cue-3-edited
- **Missing:** Presets only restyle captions; layouts/backgroundFill/flexCrop/clipFit not integrated

## Audio

### occ.audio.silence-vad — PARTIAL

- Source (0xsline/OpenChatCut): src/audio/{silence,vad,silero-vad}.ts
- Target: src/openchatcut/audio/*, public/models/silero-vad/*
- Original: RMS silence + Silero VAD speech-aware silence
- Browser: WebAudio + onnxruntime-web · Backend: none
- UI: Analyze → Find quiet spans (speech aware) · Persistence: markers · Preview: — · Export: —
- Tests: vad.verify, silence.verify
- Evidence: commit 51649c79
- **Missing:** VAD run on a clip with no speech (no spans); no positive-speech sample verified; no opt-in model panel (model ships in public/)

### occ.audio.loudness-beats — VERIFIED

- Source (0xsline/OpenChatCut): src/audio/{loudness,beats}.ts
- Target: src/openchatcut/audio/*
- Original: LUFS loudness, beat markers
- Browser: WebAudio · Backend: none
- UI: Analyze · Persistence: markers/volume · Preview: — · Export: —
- Tests: loudness.verify, beats.verify
- Evidence: commit e2900891

### occ.audio.beat-this-clap — NOT_STARTED

- Source (0xsline/OpenChatCut): src/audio/intelligence/*
- Target: —
- Original: Beat This (≈83 MB via /api/hf-proxy), CLAP tagging
- Browser: onnxruntime-web workers · Backend: /api/hf-proxy
- UI: none · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** Needs opt-in model loader without hf-proxy (CORS/licence check)

### occ.audio.sound-library — VERIFIED

- Source (0xsline/OpenChatCut): src/audio/soundLibrary.ts, assets/sound-effects/*.mp3
- Target: src/openchatcut/audio/soundLibrary.ts, public/sound-effects/*, src/cinegen/components/edit/sound-library-popup.tsx
- Original: Sound-effect library (39 files)
- Browser: audio · Backend: none
- UI: Edit sidebar → Sound effects · Persistence: asset + audio clip · Preview: — · Export: audio in export
- Tests: browser add test
- Evidence: commits 663e7637 + this branch (10 missing mp3 added)

### occ.audio.recorder — VERIFIED

- Source (0xsline/OpenChatCut): src/audio/recorder.ts
- Target: src/openchatcut/audio/recorder.ts
- Original: Mic voice-over
- Browser: getUserMedia · Backend: none
- UI: Edit sidebar mic button · Persistence: asset + clip · Preview: — · Export: —
- Tests: browser (fake mic)
- Evidence: commit ec49002e; screenshot rec-2-after
- **Missing:** Permissions-Policy changed to microphone=(self)

### occ.audio.fades — VERIFIED

- Source (0xsline/OpenChatCut): src/editor/clipFade.ts
- Target: src/openchatcut/editor/clipFade.ts
- Original: Clip fade in/out
- Browser: pure · Backend: none
- UI: Inspector Fade · Persistence: clip.fade_in/out · Preview: preview opacity/volume · Export: MP4 luma ramp measured
- Tests: timeline tests
- Evidence: commit 7fb4850f
- **Missing:** Transition audio (transitionAudio.ts) not integrated

### occ.audio.beat-this — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/audio/intelligence/{beatThis.worker,beatThisClient,beatThisPreprocess,audioDecode,types,sections}.ts
- Target: src/openchatcut/audio/intelligence/*, src/cinegen/lib/occ/analysis.ts beatThisOf, Analyze → Beat This
- Original: Neural beat/downbeat tracker, opt-in ≈83 MB Hugging Face download (their /api/hf-proxy removed), progress + cancel
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343)
- **Missing:** Model never downloaded or run here; modules compile in the dev server; WebGPU→WASM fallback is their code

### occ.audio.clap — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/audio/intelligence/{clap.worker,clapClient,clapProfile,clapTypes}.ts, clap-prototypes.json
- Target: src/openchatcut/audio/intelligence/*, Analyze → Tag audio (CLAP)
- Original: CLAP music tagging, opt-in download
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343)
- **Missing:** Model never downloaded or run here

## Editing

### occ.edit.speed — VERIFIED

- Source (0xsline/OpenChatCut): src/editor/rateStretch.ts
- Target: src/openchatcut/editor/rateStretch.ts
- Original: 0.1–8× speed
- Browser: pure · Backend: none
- UI: Inspector Speed · Persistence: clip.speed · Preview: — · Export: —
- Tests: timeline-operations tests
- Evidence: commit 7fb4850f
- **Missing:** Speed curves not integrated

### occ.edit.ops — PARTIAL

- Source (0xsline/OpenChatCut): src/editor/{split,slip,snap,overwrite,multiSelect,linkGroups,layouts}.ts
- Target: —
- Original: Edit operations on their model
- Browser: pure · Backend: none
- UI: CineGen already has split/slip/slide/ripple/roll/snap/link · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: CineGen equivalents
- **Missing:** Compare and fill gaps (overwrite, layouts) — not done

### occ.edit.transform — PARTIAL

- Source (0xsline/OpenChatCut): src/editor/{clipTypes,keyframes,keyframeRegistry}.ts (transform model)
- Target: src/cinegen/lib/occ/transform.ts, src/cinegen/components/edit/clip-transform-section.tsx, src/lib/editor/remotion/TimelineComposition.jsx (OccTransform)
- Original: Clip position/scale/rotation (+ keyframes in their model)
- Browser: CSS transform · Backend: none
- UI: Inspector → Transform sliders + Reset · Persistence: clip.transform_json · Preview: viewer wrapper css (computed style verified in browser) · Export: exported MP4 frame: clip scaled 0.5, rotated 15 deg, shifted 40% right, left quarter black (measured luma 0 vs control 151)
- Tests: occ-transform.test.ts (3)
- Evidence: docs/evidence/transform/ (tr-frame.png, tr-control.png, tr-1-preview.png); this branch
- **Missing:** No keyframes UI for position/scale/rotation (only the tracked path); no undo-specific test beyond the shared SET_TIMELINE history; reload persistence covered by converter test only (not browser)

### occ.edit.layouts — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/editor/layouts.ts
- Target: src/openchatcut/editor/layouts.ts, src/cinegen/components/edit/clip-layout-section.tsx, src/cinegen/lib/occ/transform.ts (crop)
- Original: Split screen / grid / picture-in-picture slot placement
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343)
- **Missing:** Per-element transform+crop in preview verified for transform only; layout apply not driven in a browser; export applies clip-path crop but not frame-checked

### occ.edit.transform-keyframes — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/editor/keyframes.ts (idea)
- Target: src/cinegen/lib/occ/transform.ts, clip-transform-section.tsx
- Original: Position/scale/rotation keyframes
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343)
- **Missing:** Interpolation unit-tested; keyframe UI not browser-driven; no easing options

## Export

### occ.export.fcpxml — VERIFIED

- Source (0xsline/OpenChatCut): src/export/fcpxml.ts
- Target: src/openchatcut/export/fcpxml.ts, src/cinegen/lib/occ/fcpxml.ts
- Original: FCPXML
- Browser: text · Backend: none
- UI: Export → Export FCPXML · Persistence: — · Preview: — · Export: —
- Tests: fcpxml.verify
- Evidence: commit 4420c88b; re-synced with upstream

### occ.export.quality-bitrate — VERIFIED

- Source (0xsline/OpenChatCut): src/export/{quality,bitrate,autoQa}.ts, src/media/qualityPolicy.ts
- Target: src/openchatcut/export/*, src/cinegen/lib/occ/export-qa.ts
- Original: Bitrate modes, master quality, export QA (FFmpeg server in original)
- Browser: canvas/WebAudio · Backend: /api/export-qa replaced by browser analysis
- UI: Export tab · Persistence: localStorage prefs · Preview: — · Export: bitrate honoured (1 vs 20 Mbps files differ)
- Tests: quality.verify, occ-export-bitrate
- Evidence: commit ec49002e; screenshot qa-2-result
- **Missing:** Browser QA ≠ FFmpeg detectors

### occ.export.jianying — BLOCKED

- Source (0xsline/OpenChatCut): src/export/jianyingDraftRequest.ts
- Target: —
- Original: JianYing draft export
- Browser: server external-agent · Backend: external-agent server endpoint
- UI: none · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Blocker:** Uses an external-agent server endpoint; no verified serverless packaging

### cg.export — VERIFIED

- Source (christopherjohnogden/CineGen): components/export/*
- Target: components/export/*
- Original: MP4 export verified incl. fx, captions, fades, plugin fx; docs/evidence/other/qa-2-result.png, commits d4901164 7fb4850f ec49002e
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: MP4 export verified incl. fx, captions, fades, plugin fx; docs/evidence/other/qa-2-result.png, commits d4901164 7fb4850f ec49002e

## Agent

### occ.agent — NOT_APPLICABLE

- Source (0xsline/OpenChatCut): src/agent/**
- Target: —
- Original: AI agent runtime
- Browser: server · Backend: Node server, Codex/Claude Code CLIs
- UI: CineGen LLM tab replaces it · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Blocker:** Server-only

## Project management

### cg.project — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen): src/cinegen/WebApp.tsx, adapters/web-store.ts, adapters/legacy-import.ts
- Target: src/cinegen/WebApp.tsx, adapters/web-store.ts, adapters/legacy-import.ts
- Original: create/open/persist/reload/old-project import were browser-checked in earlier sessions but no evidence artefact was stored; re-verify in the final regression
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: create/open/persist/reload/old-project import were browser-checked in earlier sessions but no evidence artefact was stored; re-verify in the final regression
- **Missing:** Live provider verification pending

## Voice design

### cg.voice-design — BLOCKED

- Source (christopherjohnogden/CineGen): adapters/web-elevenlabs.ts
- Target: adapters/web-elevenlabs.ts
- Original: no MuAPI text-to-voice-design model
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: no MuAPI text-to-voice-design model
- **Missing:** Live provider verification pending
- **Blocker:** no provider model

## Existing remix-new-editor features

### rm.overlays.lead-form — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/lib/editor/addons/*, src/cinegen overlay lane
- Target: src/lib/editor/addons/*, src/cinegen overlay lane
- Original: Lead Generator overlay
- Browser: yes · Backend: existing Netlify/Supabase
- UI: Edit → Library → Overlays & forms (click opens the Add window, + adds); Add to timeline → Overlays & forms; Overlays lane shows a live picture of each block · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772; docs/evidence/merge-check/46-add-overlays-and-forms.png, 81-everything-added-in-timeline.png; commit 014616dc
- **Missing:** overlay lane + renderer integrated (commit a6065f71); interactive publish path not re-verified

### rm.overlays.list-cta — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/lib/editor/addons/*
- Target: src/lib/editor/addons/*
- Original: List Builder / CTA overlays
- Browser: yes · Backend: existing Netlify/Supabase
- UI: Edit → Library → Overlays & forms (click opens the Add window, + adds); Add to timeline → Overlays & forms; Overlays lane shows a live picture of each block · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772; docs/evidence/merge-check/46-add-overlays-and-forms.png, 81-everything-added-in-timeline.png; commit 014616dc
- **Missing:** as above

### rm.overlays.text-image — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): commit 49777772
- Target: commit 49777772
- Original: Smart Text, Text Mask, Image, Personalized Image, Stickers, Wrapper, Lower Thirds
- Browser: yes · Backend: existing Netlify/Supabase
- UI: Edit → Library → Overlays & forms (click opens the Add window, + adds); Add to timeline → Overlays & forms; Overlays lane shows a live picture of each block · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772; docs/evidence/merge-check/46-add-overlays-and-forms.png, 81-everything-added-in-timeline.png; commit 014616dc
- **Missing:** on the overlay lane, viewer verified earlier; export of overlays not burned into MP4 (interactive publish only)

### rm.end-screens — IMPLEMENTED_UNVERIFIED

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/components/modals/{EndScreen,Connect}*
- Target: src/components/modals/{EndScreen,Connect}*
- Original: End Screens / Connect Form
- Browser: yes · Backend: existing Netlify/Supabase
- UI: Edit → Library → Overlays & forms; Add to timeline → "End screens & connect forms" (13 templates) · Persistence: — · Preview: — · Export: —
- Tests: library-panel.test.tsx, add-to-timeline-registry tests
- Evidence: docs/evidence/merge-check/20-left-library-tab.png, 47-add-end-screens-connect-forms.png; commits 24402eb7, 014616dc
- **Missing:** The list and cards were seen in a browser run; adding an end screen and watching it render in the viewer was not driven

### rm.personalization — IMPLEMENTED_UNVERIFIED

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/components/personalize/*
- Target: src/components/personalize/*, src/cinegen/components/export/personalized-output.tsx, src/cinegen/adapters/web-api.ts (one MP4 per contact), src/lib/editor/addons/studioDesignAddon.js
- Original: Personalization / Tokens / Batch Generator
- Browser: yes · Backend: existing Netlify/Supabase
- UI: Edit → Overlays lane 👤 opens the Personalization Suite (Upload Video, Import Contacts, Configure Tokens, Generate Videos, Create Landing Pages, View Analytics); Publish → Contacts and Email; Export tab → Personalized output (tick contacts, then Download MP4s and/or Create links); Add to timeline → Overlays & forms → Studio Design (a Personalization Studio design filled per contact) · Persistence: — · Preview: — · Export: One MP4 per chosen contact from the in-browser renderer; one stored personal link per contact (/watch/<id>?p=<link>)
- Tests: publish-contacts*.test, publish-email*.test; personalized-export.test.ts (one MP4 per contact, unique names, a failure does not stop the rest), studio-design-overlay.test.ts, guestFields.test.js, linksOnlyPanel.test.js. Live on the PR 188 deploy preview, signed out: Download MP4s gave two H.264 MP4s named per contact, each with that contact's design text; two personal links each showed that contact's details to a viewer
- Evidence: docs/evidence/merge-check/27 (personalization suite, in 25-27 contact sheet), 94-publish-contacts-list.png; commits 843e3ff9, 43661fb1; PR #141 and PR #188 (deploy previews, live checks 18-23 Nov 2026)
- **Missing:** Signed-in end-to-end run (Clerk session) not done: the signed-in database rules were checked on the live project with simulated claims only. Landing pages and per-contact video generation still need sign-in and provider keys; not run. The editor preview draws a Studio design as a labelled box; the published video and the MP4 draw the design itself

### rm.end-screens-connect — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/lib/editor/addons/templateLibrary.js
- Target: src/cinegen/lib/overlays/overlays.ts createTemplateOverlays, overlay lane menu
- Original: End Screens and Connect Form template libraries as overlays
- Browser: yes · Backend: none
- UI: Edit → Library → Overlays & forms; Add to timeline → End screens & connect forms · Persistence: — · Preview: — · Export: —
- Tests: compiled; unit tests where noted
- Evidence: this branch (commits after d684a343); docs/evidence/merge-check/47-add-end-screens-connect-forms.png
- **Missing:** Unit test only; not seen rendering in the viewer

### rm.share-publish — IMPLEMENTED_UNVERIFIED

- Source (0xsline/OpenChatCut@9242a95): src/lib/editor/publish/{sharePanel,publishClient}.js
- Target: src/cinegen/components/export/share-panel.tsx, src/cinegen/components/leads/{use-publish.ts,personal-links-card.tsx}, src/lib/guestIdentity.js, netlify/functions/guest-{token,claim}.js
- Original: Share / publish interactive video from the CineGen timeline + overlays
- Browser: yes · Backend: Netlify functions guest-token / guest-claim (need SUPABASE_JWT_SECRET); Supabase published_videos, video_personalizations and the guest rules (migrations 20261115000000, 20261115120000, 20261119000000)
- UI: Publish tab → Share & Leads (publish, link, embed) and Personal links (edit what a link shows, new address, turn off or on, remove, CSV); works without an account (guest identity, content kept 30 days after last use, 10 videos and 200 links); Export tab → Personalized output creates the links; after sign-in the editor offers to move guest content to the account · Persistence: published_videos and video_personalizations; the guest credential stays in this browser's localStorage · Preview: — · Export: —
- Tests: use-publish-guest.test.ts, linksOnlyPanel.test.js, guestPublishing.test.js, guest-token.test.js, guest-claim.test.js, guestIdentity.test.js; SQL assertions 51 and 52 (guest quotas, unlisted, claim, prune, quota lock). Live on deploy previews, signed out: publish, create links, open them as a viewer, edit, turn off, new address (old one stops), remove
- Evidence: this branch (commits after d684a343); docs/evidence/merge-check/91-publish-tab-share-and-leads.png; commit 440b44bd; PR #141 and PR #188 (deploy previews, live checks 18-23 Nov 2026); screenshots in the PR discussion
- **Missing:** Signed-in publishing not run live (database rules checked with simulated signed-in claims); the sign-in → 'move my guest videos' prompt not run live (claim function and database path tested separately); Analytics tab still needs an account

## CineGen Elements

### cg.elements.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/elements/*, src/components/elements/*
- Target: src/cinegen/lib/elements/*, src/cinegen/components/elements/*
- Original: Element model, reference panels (7 per category), angles, folders, voice, mentions in prompts
- Browser: yes · Backend: OpenAI Images 2.6 for panel generation
- UI: Elements tab renders (screenshots in earlier sessions) · Persistence: IndexedDB ProjectStore · Preview: — · Export: —
- Tests: upstream tests ported: components/elements 7, lib/llm (prompt-elements) pass; occ-muapi-references.test.ts (3)
- Evidence: src/cinegen/__tests__/upstream/EXCLUDED.md; this commit
- **Missing:** Panel generation, per-panel regeneration, variations and active-variation selection were not run against a live provider; reference panels per category (7) not re-counted in a browser run; element voice assignment/saved voices not browser-tested

### cg.elements.references-to-generation — VERIFIED

- Source (christopherjohnogden/CineGen@769f148): src/lib/llm/prompt-elements.ts, src/lib/workflows/execute.ts
- Target: src/cinegen/lib/muapi/model-catalog.ts (reference ports), src/cinegen/lib/cloud/funding.ts
- Original: Element mentions/references reach the generation request
- Browser: yes · Backend: MuAPI (request mocked)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: occ-muapi-references.test.ts (3, provider mocked): text-to-image model gets a reference port, @mention wires the Element into it, request with references routes to the -edit sibling
- Evidence: this commit; found by CineGen's own prompt-elements tests
- **Missing:** Live MuAPI request with a real reference was not run (mocked provider); identity preservation is whatever the MuAPI -edit model does, not guaranteed here

## CineGen Spaces / Studio

### cg.spaces.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/workflows/*, src/lib/studio/*, src/components/create/*
- Target: src/cinegen/lib/workflows/*, src/cinegen/lib/studio/*, src/cinegen/components/create/*
- Original: Node registry, port compatibility, topo ordering, execution, Studio recipes/presets/clips
- Browser: yes · Backend: MuAPI/OpenAI for generation
- UI: rendered in earlier browser runs · Persistence: workflow/studio state in ProjectStore · Preview: — · Export: —
- Tests: CineGen's own tests ported and passing: lib/studio 78, lib/workflows 23, components/create 100 (node/palette/canvas/studio components)
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** Provider-specific workflow tests (Higgsfield/Topview/RunPod) are excluded; full-graph execution against live MuAPI not run; studio/recipe.ts covered only by the ported studio tests; Studio→Edit transfer not browser-tested

## CineGen Sets

### cg.sets.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/sets/*, src/components/sets/*, src/types/sets.ts
- Target: src/cinegen/lib/sets/*, src/cinegen/components/sets/*
- Original: 3D scene planning: camera, floor plan, placement, Shape Shot, packaging, camera prompts
- Browser: yes · Backend: browser WebGL
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: CineGen's own tests ported and passing: lib/sets 105, components/sets 11
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** Camera manipulation, Shape Shot capture and use of a captured reference in a generation workflow were NOT driven in a browser; no splat/scene file exercised in sandbox

## CineGen Director

### cg.director.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/director/*, src/components/director/*
- Target: src/cinegen/lib/director/*, src/cinegen/components/director/*
- Original: Script import (fountain/FDX), breakdown, Look Bible, shotlist, takes, notes, generation
- Browser: yes · Backend: OpenAI + MuAPI
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: earlier ported director tests (src/cinegen/__tests__/director) + upstream components/director 19 passing
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** Script→shotlist→generation→timeline flow not run (no provider keys); Topview/Higgsfield/RunPod provider switching tests excluded by design; keep/discard and take rejoin UI not browser-tested

## CineGen Edit

### cg.edit.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/editor/*, src/components/edit/*
- Target: src/cinegen/lib/editor/*, src/cinegen/components/edit/*
- Original: 10 tools, tracks, keyframes, transitions, sync, proxy, generated clips
- Browser: yes · Backend: none for editing; MuAPI for Fill Gap/Extend/Music
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: editor unit tests (timeline-operations etc.) + upstream components/edit 1; browser: import, drag, trim/split basics, fades, transform, multicam cut, recorder
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** Each of the 10 tools was not individually driven in a browser against real clips (Blade/Ripple/Roll/Slip/Slide/Mask/Music/Fill Gap/Extend); dual-viewer/source viewer, mute/solo/lock, batch sync, proxy playback not re-verified in this run

## CineGen LLM / Assistant / skills

### cg.llm.logic — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/llm/*, src/lib/assistant/*, src/components/llm/*, src/components/assistant/*
- Target: src/cinegen/lib/llm/*, src/cinegen/lib/assistant/*, src/cinegen/components/llm/*
- Original: Ask/Search/Cut/Timeline, skills, skill-actions, canvas visual context
- Browser: yes · Backend: OpenAI Responses
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: CineGen's own tests ported and passing: lib/llm 113, lib/assistant 30, components/assistant 1; copilot-looks.test.ts
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** No live OpenAI conversation was run; skill-actions that create video model nodes differ (provider registry) and those 2 tests are skipped; undo of AI-created nodes not browser-tested

## CineGen MCP / project control

### cg.mcp — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/lib/mcp/*, mcp/*.mjs
- Target: src/cinegen/lib/mcp/*
- Original: MCP tools exposing project state
- Browser: yes · Backend: desktop MCP launcher (not used)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: upstream lib/mcp 30 tests pass (handlers/state); catalog/stdio/viewer-launcher tests excluded
- Evidence: src/cinegen/__tests__/upstream/
- **Missing:** The stdio MCP server and viewer launcher are desktop-only

## CineGen persistence / migration

### cg.persistence — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen@769f148): src/lib/cloud/*, electron/ipc/project.ts
- Target: src/cinegen/adapters/web-store.ts, src/cinegen/adapters/legacy-import.ts
- Original: Project store, autosave, undo/redo, migration
- Browser: yes · Backend: IndexedDB
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: components/workspace 20 upstream tests pass; reload persistence checked for clip fx/transform in converter tests
- Evidence: earlier session browser runs (no stored artefact)
- **Missing:** Project reload in a browser not re-verified in this run

## CineGen server services

### cg.services — VERIFIED

- Source (christopherjohnogden/CineGen@769f148): web/server/services/*, electron/ipc/*
- Target: src/cinegen/adapters/*
- Original: Classification of each service
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: documentation audit
- Evidence: docs/cinegen-services-classification.md (commit of this stage)

## CineGen settings page

### cg.settings-parity — PARTIAL

- Source (christopherjohnogden/CineGen@769f148): src/components/settings/settings-page.tsx
- Target: src/cinegen/components/settings/settings-page.tsx
- Original: Settings: providers, ElevenLabs, preferences, resolution/frame/aspect
- Browser: yes · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: upstream components/settings tests excluded (provider cards removed)
- Evidence: src/cinegen/__tests__/upstream/EXCLUDED.md
- **Missing:** 962-line divergence from upstream: fal/RunPod/Topview/Higgsfield/team provider sections removed; MCP-connect pages removed; not re-diffed section by section in this run

## Desktop-only (Electron, cloud account, MCP pages, local models, CLI LLMs)

### cg.desktop-only — NOT_APPLICABLE

- Source (christopherjohnogden/CineGen@769f148): main.tsx, App.tsx, components/cloud/cloud-account.tsx, components/settings/{claude,remote}-mcp-connect.tsx, electron/ipc/{local-models,codex-cli,gemini-cli,claude-code,cli-llm-*,sam3-server}.ts
- Target: —
- Original: Native/desktop features
- Browser: no · Backend: desktop
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: documentation
- Evidence: docs/cinegen-services-classification.md (commit of this stage)
- **Blocker:** Electron / native / Python / CLI-based; not allowed in the browser app

## CineGen Export

### cg.export.aspect — VERIFIED

- Source (christopherjohnogden/CineGen@769f148): src/components/export/export-settings.tsx
- Target: src/cinegen/components/export/export-settings.tsx, src/lib/editor/remotion/timelineToComposition.js (frameForAspect)
- Original: Export presets + aspect ratio / resolution
- Browser: yes · Backend: none (Remotion web renderer)
- UI: Export tab: aspect select (16:9, 9:16, 1:1, 4:5, 21:9) with the resulting frame size shown · Persistence: per export, not stored · Preview: size label · Export: 9:16 at the Draft preset exported as 720x1280 (ffprobe)
- Tests: occ-export-aspect.test.ts (2); browser export
- Evidence: docs/evidence/export/aspect-selector.png; ffprobe 720,1280; commit of this stage
- **Missing:** Clips use cover fit, so a 16:9 clip in a 9:16 frame is centre-cropped (reposition with Transform/zoom); viewer preview stays 16:9; no custom resolution entry

## Discoverability

### ux.library-pictures — VERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): src/cinegen/components/edit/library-panel.tsx (text-only cards)
- Target: src/cinegen/components/edit/library-panel.tsx, src/cinegen/components/edit/library-card.tsx, src/cinegen/lib/occ/library-memory.ts
- Original: Library side panel was text; no cross-category search, no Template videos, no favorites
- Browser: yes · Backend: none
- UI: Edit → Library: picture cards, one search across every category, chips with counts, click opens the Add window on the item, + adds, ★ Favorites and Recent · Persistence: localStorage cinegen_library_memory · Preview: thumbnails, video posters (play on hover), live previews · Export: —
- Tests: library-panel.test.tsx, library-memory.test.ts; real-browser runs (search, click-to-modal, favorites after reload)
- Evidence: docs/evidence/merge-check/70-75, 87, 88; commits 24402eb7, a447776b
- **Missing:** Effect/transition thumbnails render dark in headless Chromium (WebGL); not checked in a real browser

### ux.add-shows-real-media — VERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): 
- Target: src/cinegen/components/edit/template-video-placement.ts, src/cinegen/lib/editor/free-track.ts, src/cinegen/components/edit/overlay-lane.tsx
- Original: Template videos had no filmstrip/waveform; sounds could land on top of other audio; forms had no picture in the lane
- Browser: yes · Backend: remote clip host sends CORS * (checked)
- UI: Everything added from the Library shows real frames / waveform in its clip, a picture on the Overlays lane, is selected, and appears in the viewer · Persistence: project · Preview: filmstrip, waveform, live overlay stills · Export: —
- Tests: template-video-placement.test.ts, free-track.test.ts; browser runs
- Evidence: docs/evidence/merge-check/80, 81, 82; commits 014616dc, 287987be

### ux.empty-start-and-generator — VERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): 
- Target: src/cinegen/components/edit/empty-start.tsx, src/cinegen/components/workspace/workspace-history.ts, src/cinegen/lib/occ/template-composition.ts
- Original: Blank project showed a black viewer; Template Generator dropped content at the end and took many undo steps
- Browser: yes · Backend: none
- UI: Blank project → Start your video (Add your video / Pick a template video / Make a video for me); Template Generator inserts at the playhead as one undo step (BATCH action) · Persistence: project · Preview: — · Export: —
- Tests: empty-start.test.tsx, template-composition-batch.test.ts
- Evidence: docs/evidence/merge-check/83, 84, 85; commits 0b34ff51, a9df2993

### ux.inspector-groups — VERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): 
- Target: src/cinegen/components/edit/clip-properties-panel.tsx, src/cinegen/components/edit/inspector-group.tsx, src/cinegen/components/edit/use-inspector-groups.ts
- Original: 14 stacked Inspector sections in a 357px panel, two both titled Transform
- Browser: yes · Backend: none
- UI: Edit → Inspector: Basics / Look / Position and motion / Captions / Analyze groups, Find a setting, full-height panel; Flip renamed; Translated .srt next to Captions · Persistence: localStorage cinegen_inspector_groups · Preview: — · Export: —
- Tests: inspector-groups.test.tsx, help-coverage.test.ts
- Evidence: docs/evidence/merge-check/89, 90; commits 10e474e9, c05d4ab2

## Publish

### rm.publish.social — IMPLEMENTED_UNVERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): components/modals/SocialPublishModal.jsx, src/lib/socialPublishing.js
- Target: src/cinegen/components/publish/social-panel.tsx, src/cinegen/lib/publish/social-media.ts, components/modals/SocialPublishModal.jsx
- Original: Classic Social chip opened the 5-step Publish to Social window (muapi: YouTube, TikTok, Instagram)
- Browser: yes · Backend: muapi-proxy edge function (server key), Clerk, Supabase storage
- UI: Publish → Social: pick an export / media-pool video / template video; opens the restyled Publish to Social window with a public link (local videos are uploaded first) · Persistence: — · Preview: picture cards · Export: posts to the user's connected accounts
- Tests: social-media.test.ts, publish-tab.test.tsx; browser run (cards, click opens the window)
- Evidence: docs/evidence/merge-check/92, 93, 96; commits 440b44bd, 164da418
- **Missing:** Real posting, account connection and the upload step were not run (no keys / sign-in in the sandbox)

### rm.publish.contacts — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code)): src/components/modals/ContactImporterModal.jsx (mockup), src/lib/contactStore.js
- Target: src/cinegen/components/publish/contacts-panel.tsx, src/cinegen/lib/publish/contacts.ts
- Original: Classic Contacts modal was a mockup; real contacts live in the browser store, video leads and landing pages
- Browser: yes · Backend: Supabase (video_leads, landing_page_contacts) for two of the three sources
- UI: Publish → Contacts: one list (same email once), CSV import/export, search, filter by source, remove imported · Persistence: localStorage remix_contacts (imported) · Preview: table · Export: CSV
- Tests: publish-contacts.test.ts, publish-contacts-panel.test.tsx; browser run: import, search, download, reload, remove
- Evidence: docs/evidence/merge-check/94; commit 843e3ff9
- **Missing:** Video-lead and landing-page sources need sign-in and Supabase; shown only through mocked tests and the "could not be loaded" state

### rm.publish.email — IMPLEMENTED_UNVERIFIED

- Source (deangilmoreremix/remix-new-editor (own code)): src/components/modals/EmailCampaignModal.jsx (mockup), netlify/functions/landing-sync.js
- Target: src/cinegen/components/publish/email-panel.tsx, src/cinegen/lib/publish/email-sync.ts
- Original: Classic Email Campaign modal was a mockup with a fake send
- Browser: yes · Backend: /api/landing-sync (MailerLite, bring-your-own token)
- UI: Publish → Email: connect MailerLite, choose who, video link, "Add to MailerLite" (does not send email; says so) · Persistence: token in localStorage sv_mailerlite_token · Preview: — · Export: adds contacts + video link to the user's MailerLite account
- Tests: publish-email-sync.test.ts, publish-email-panel.test.tsx (mocked sync client); browser run of the gated states
- Evidence: docs/evidence/merge-check/95; commit 43661fb1
- **Missing:** A real MailerLite connect/push was not run; sending a list to Kit is not built (landing-sync omits Kit)
