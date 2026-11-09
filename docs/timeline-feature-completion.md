# Timeline Studio Editor — feature completion ledger

Generated from `docs/timeline-feature-ledger.json` by `scripts/ledger-check.mjs` (branch `claude/confident-fermi-3azaem`, OpenChatCut upstream `9242a95`).

**Never read PARTIAL / IMPLEMENTED_UNVERIFIED / BLOCKED as done.** Only VERIFIED rows have tests and evidence recorded.

## Totals

| Status | Count |
|---|---|
| NOT_STARTED | 5 |
| SOURCE_FOUND | 1 |
| PARTIAL | 13 |
| IMPLEMENTED_UNVERIFIED | 7 |
| VERIFIED | 17 |
| BLOCKED | 2 |
| NOT_APPLICABLE | 2 |
| **All** | 47 |

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

### occ.templates.mg — NOT_STARTED

- Source (0xsline/OpenChatCut): src/template-host.ts, src/library/TemplateBrowser.tsx, assets/templates/*.json
- Target: —
- Original: Motion-graphics templates that run template code in a sandbox
- Browser: iframe sandbox (browser) · Backend: none
- UI: none · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** Template runtime + template browser not integrated (3 template packs, 1.9 MB); the repo's classic editor has its own Remotion code layer (src/lib/editor/remotion/codeLayer.jsx) that could host them

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

### occ.reframe.auto — SOURCE_FOUND

- Source (0xsline/OpenChatCut): src/reframe/detect.ts
- Target: —
- Original: Browser saliency/energy + FaceDetector auto-reframe
- Browser: canvas, optional FaceDetector · Backend: none
- UI: none · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** Not integrated: plan = detect → focal curve → zoom reframeCurve + target aspect

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

## Elements

### cg.elements — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen): components/elements/*
- Target: components/elements/*
- Original: UI present and rendering; generation needs OpenAI key (not live-tested)
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: UI present and rendering; generation needs OpenAI key (not live-tested)
- **Missing:** Live provider verification pending

## Spaces

### cg.spaces — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen): components/create/*
- Target: components/create/*
- Original: canvas/panels render; generation nodes need MuAPI/OpenAI credits (route checks only)
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: canvas/panels render; generation nodes need MuAPI/OpenAI credits (route checks only)
- **Missing:** Live provider verification pending

## Director

### cg.director — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen): components/director/*
- Target: components/director/*
- Original: tabs render; LLM jobs need OpenAI key
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: tabs render; LLM jobs need OpenAI key
- **Missing:** Live provider verification pending

## Edit tools

### cg.edit — PARTIAL

- Source (christopherjohnogden/CineGen): components/edit/*
- Target: components/edit/*
- Original: core editing, import, persistence browser-verified; Fill Gap/Extend/Music need MuAPI credits
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: core editing, import, persistence browser-verified; Fill Gap/Extend/Music need MuAPI credits
- **Missing:** Live provider verification pending

## LLM tab + assistant

### cg.llm — IMPLEMENTED_UNVERIFIED

- Source (christopherjohnogden/CineGen): components/llm/*, components/assistant/*
- Target: components/llm/*, components/assistant/*
- Original: needs OpenAI key
- Browser: yes · Backend: MuAPI/OpenAI (adapted)
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: needs OpenAI key
- **Missing:** Live provider verification pending

## Desktop-only (Electron, cloud account, Claude MCP pages)

### cg.desktop-only — NOT_APPLICABLE

- Source (christopherjohnogden/CineGen): main.tsx, App.tsx, cloud-account.tsx, claude-mcp-connect.tsx, remote-mcp-connect.tsx
- Target: main.tsx, App.tsx, cloud-account.tsx, claude-mcp-connect.tsx, remote-mcp-connect.tsx
- Original: Electron/cloud only
- Browser: no · Backend: none
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: vitest suites (584+)
- Evidence: Electron/cloud only

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
- UI: — · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772
- **Missing:** overlay lane + renderer integrated (commit a6065f71); interactive publish path not re-verified

### rm.overlays.list-cta — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/lib/editor/addons/*
- Target: src/lib/editor/addons/*
- Original: List Builder / CTA overlays
- Browser: yes · Backend: existing Netlify/Supabase
- UI: — · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772
- **Missing:** as above

### rm.overlays.text-image — PARTIAL

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): commit 49777772
- Target: commit 49777772
- Original: Smart Text, Text Mask, Image, Personalized Image, Stickers, Wrapper, Lower Thirds
- Browser: yes · Backend: existing Netlify/Supabase
- UI: — · Persistence: saved with project (overlays) · Preview: — · Export: —
- Tests: vitest overlays.test.ts
- Evidence: commits a6065f71, f15abc1a, 49777772
- **Missing:** on the overlay lane, viewer verified earlier; export of overlays not burned into MP4 (interactive publish only)

### rm.end-screens — NOT_STARTED

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/components/modals/{EndScreen,Connect}*
- Target: src/components/modals/{EndScreen,Connect}*
- Original: End Screens / Connect Form
- Browser: yes · Backend: existing Netlify/Supabase
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** not reconnected to the timeline

### rm.personalization — NOT_STARTED

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/components/personalize/*
- Target: src/components/personalize/*
- Original: Personalization / Tokens / Batch Generator
- Browser: yes · Backend: existing Netlify/Supabase
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** not reconnected

### rm.share-publish — NOT_STARTED

- Source (deangilmoreremix/remix-new-editor (own code / upstream strategic-limited/remix-new-editor)): src/lib/editor/publish/*
- Target: src/lib/editor/publish/*
- Original: Share / Publish
- Browser: yes · Backend: existing Netlify/Supabase
- UI: — · Persistence: — · Preview: — · Export: —
- Tests: —
- Evidence: —
- **Missing:** not reconnected
