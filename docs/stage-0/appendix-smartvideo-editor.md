# Audit: editors in /home/user/remix-new-editor (read-only; code actually opened)

Verdicts: (1) implemented + tests, (2) implemented but broken/stubbed, (3) partial, (4) missing.
"Export" = takes effect in Remotion web-render path (src/export-runner/main.jsx -> TimelineComposition.jsx). "Preview" = editor preview only.
Test status is by `*.test.*` files that vitest collects (vitest.config.js; `*.verify.ts` in src/openchatcut are NOT collected - no "verify" script runs them except `verify:video-agent-studio` which targets apps/).
Line counts are `wc -l`. Not exhaustively opened: vendored remotionui scenes, hyperframes catalog JSON, openchatcut i18n.

## 0. Architecture: three editors, one exporter

| System | Route | Files | State model | Preview | Export |
|---|---|---|---|---|---|
| CineGen (default) | `#/timeline` (src/lib/router.js:121 -> src/cinegen/mount.tsx) | src/cinegen/components/edit/* (timeline-editor.tsx 3723, edit-tab.tsx 1296, left-panel 1956), lib/editor/timeline-operations.ts 997, playback-engine.ts 1261 | `Timeline{tracks[],clips[],transitions[],markers[]}` flat clips, seconds (src/cinegen/types/timeline.ts) | DOM `<video>` pool + WebAudio gain nodes (PlaybackEngine) + openchatcut GL layer (gl-clip-layer.tsx). NO Remotion in preview | `electronAPI.export.start` shim in src/cinegen/adapters/web-api.ts:128-215, which rebuilds a *classic-shaped* state and calls timelineToComposition + exportModel |
| Classic | `#/timeline-classic` (src/components/TimelineEditorPage.jsx, 10303 lines, imperative DOM) | src/lib/editor/* (TimelineState.js 1008, editTools.js 312, remotion/*, addons/*) | `state.tracks[].items[]` with `left/width` % of `timelineSeconds` | Remotion `<Player>` (previewEngine.jsx) or DOM; legacy MediaRecorder exporter `exportPipeline.js` still wired as "basic export" (page:8542) | exportModel via timelineToComposition (page:5714, 8438) |
| OpenChatCut (vendored, AGPL) | not a route; library used by both | src/openchatcut/* (21.8k lines) | own types (clipTypes.ts, timelineTypes.ts) mostly unused as a model; used as pure cores/GL | GL runtime (gl/ClipFx.tsx, runtime.ts) | burned in via `occFx`, `occCaptions`, `glTransitions` on the Remotion model |
| Remotion model | n/a | src/lib/editor/remotion/{timelineToComposition.js 275, TimelineComposition.jsx 714, transitionMap.js 89, effects.js 152, keyframes.js 160, captions.js 167, exportClient.js 129, exportWarnings.js 37}, src/export-runner/main.jsx 132 | JSON `model{layers[],audio[],transitions[],occCaptions,glTransitions,fonts}` | `<Player>` | `renderMediaOnWeb` (h264/vp9, mp4/webm/mov) in sandboxed iframe /export-runner.html |

Other (legacy / dead-ish) timelines: src/timeline/* (4 files, 46-69 lines, only tests import them), src/components/Timeline.js, RealTimelinePage.js, TimelineTestPage.jsx, VideoEditorPage.js (self-declared stub, line 11), src/components/timeline-editor/* (645 lines, imported only by modals), src/components/timeline/{CameraEffects 929, ExportRendering 377, SceneDetector 580, AIChatPanel 346}.

### CRITICAL export-parity gaps found in CineGen -> Remotion hand-off (src/cinegen/components/export/export-tab.tsx:18-39 + web-api.ts:140-153)
The export clip list carries only: id,inputPath,startTime,duration,trimStart,speed,volume,type,trackKind,fadeIn/Out,kf,transform,fit,fx,lut,blendMode,zoom,captions. Therefore, in the exported file:
1. Track mute / solo / track volume / track `visible` are IGNORED (only `trackKind` is sent). A muted or solo-excluded track still renders audio; a hidden video track still renders. (Preview honours them: playback-engine.ts:1142-1158.)
2. Clip volume above 1.0 (CineGen allows 0-2, types/timeline.ts:47) is clamped to 1 (timelineToComposition.js `Math.min(1, clip.volume)`; TimelineComposition fadedVolume clamps to <=1).
3. Static `clip.opacity`, `flipH`, `flipV` are not sent (only opacity/volume *keyframes* and fades are).
4. Transitions: only `type==='dissolve' && glType && clipBId` reach export (export-tab.tsx:62). Plain dissolve (no glType), `fadeToBlack`, `fadeFromBlack` are dropped from export.
5. `timeline.markers` and `multicam` groups are not exported (markers are editorial only; multicam is materialised as clips so OK).
6. No audio-transition / no per-track audio fades beyond clip fadeIn/Out.
Preview vs export are different engines for CineGen (DOM+GL vs Remotion+GL), so parity relies on shared GL code (`ClipFx`, `GlTransitionLayer`).

## 1. Editing capabilities

| Capability | CineGen (default) | Classic | Export? | Verdict |
|---|---|---|---|---|
| Ripple trim | `rippleTrim` timeline-operations.ts:512; ripple tool key R (edit-tab.tsx:527), preview state timeline-editor.tsx:325 | `editTools.trimEdge(..{ripple})` editTools.js:99; page:7206; `rippleMode` page:817 (only trims tail past end on drop, page:9933) | edit-time only (result is baked in clip positions) | (1) CineGen: 76-case timeline-operations.test.ts incl. rippleTrim; classic: editTools.test.js (23 cases) |
| Rolling | `rollTrim` :566, key N | `rollEdit` editTools.js:126 | baked | (1) both tested |
| Slip | `slipClip` :603, key Y | `slipClip` :148 (linked partners slip too, page:7214) | baked (trimBefore) | (1) both |
| Slide | `slideClip` :623, key U | `slideClip` :164 | baked | (1) both |
| Linked A/V | `linkedClipIds[]`, `linkClips/unlinkClips/getLinkedIds`, auto video+audio pair on add (addClipToTrack:73-130), Cmd+L (timeline-editor.tsx:2123); moves/trims propagate | `clip.linkId`, `linkClips/linkedPartners` editTools.js:223-250, toggleClipLink page:7307 | audio+video exported as separate layers, sync preserved | (1) CineGen timeline-operations-sync.test.ts; classic editTools.test.js |
| Rate stretch / speed | `clip.speed` 0.1-8 (types:45); no stretch handle on clip edge verified | `setSpeed` editTools.js:188, `setClipSpeed` timeline-operations.js:945 | YES: `playbackRate` clamped 0.1-8 (timelineToComposition.js) | (3): constant speed only |
| Speed ramp | none | `SpeedRamping` class keyframeSystem.jsx:499-537 - no consumer (only lib/editor/index.js re-export, which nothing imports) | no | (2) classic = dead class; (4) in practice. Note `scaleKeyframes` openchatcut/editor/keyframes.ts:200 only rescales key frames on retime |
| Source monitor | source-viewer.tsx 382 (plays asset at clip offset), source-viewer-mask-tool.tsx 2296 (SAM masks); no in/out marking UI found | `data-viewer="source"` toggle (page:474) + editPanel.js `setInOut` | n/a | (3) viewer yes, no 3-point edit |
| Mark in/out | none (grep for markIn/inPoint in src/cinegen = 0) | `editTools.setInOut` editTools.js:201 via edit panel (source in/out -> clip trim) | baked | (4) CineGen; (3) classic |
| Insert / overwrite | none: addClipToTrack/moveClip never resolve overlaps; no mode toggle | `state.insertMode/overwriteMode` toolbar #tbInsertMode/#tbOverwriteMode (page:9277-9290), applied on drop page:3372-3457, `overwrite` mutation page:9920 | baked | (4) CineGen; (3) classic (drop-time only, no keyboard insert/overwrite, no tests) |
| Snapping | `snapEnabled`; half-second grid or 24fps frame grid (timeline-editor.tsx:313-316), clip-edge move snap :335-364, playhead seek snap :321 (FPS hard-coded 24, :60) | `snapEnabled`, `snapPercent` candidates (page:3269-3366), `snapToGap` | n/a | (3) works; no dedicated tests |
| Markers | `TimelineMarker{id,time,color,label}`; M key (timeline-editor.tsx:1537), drag, ctx menu | `editTools.addMarker/nextMarker/prevMarker` :210-220, `state.markers` | not exported | (1) classic editTools.test.js (marker cases); CineGen UI untested -> (3) |
| Timecode | `formatTimecode` time-ruler.tsx:12; viewer shows current/total | ruler timecodes page:10155 | n/a | (3) mm:ss(.ff) display; no timecode entry/jump, no drop-frame, 24fps assumed |
| Track mute/solo/lock | `Track{muted,solo,locked,visible,volume}`; preview honours mute/solo (playback-engine.ts:1142); lock enforced in UI | `track.muted/solo/locked` page:2691-2693, 2936; audibleTracks() in timelineToComposition.js | classic: mute/solo YES (audio+video volume forced 0); CineGen: NO (see critical gaps) | classic (1) (timeline-track-controls.test.js 9 cases); CineGen (2) export ignores |
| Clip grouping | none except `multicam` groups (lib/occ/multicam-groups.ts 121, tested occ-multicam-groups.test.ts); multi-select + drag works | `clip-group` drag payload (page:3326) only; no persistent group model | no | (4) general grouping |
| Compound / nested clips | none | none (hyperframes `nested.js` 73 is HTML-composition nesting, unrelated) | no | (4) |
| Multiple sequences | YES: `workspace.timelines[]`, tabs (timeline-tabs.tsx), create/duplicate/delete (edit-tab.tsx:560-600); no nested-sequence insert | `state.timelines` map + `activeTimelineId` (TimelineState.js; timeline-state-multitab.test.js) | export = active timeline only | (3) |
| Keyboard shortcuts | Space, <- -> (1 frame @24), V A B Y U R N G E X (edit-tab.tsx:513-536), M marker, Del, Cmd+L, Cmd+Z/Shift+Z (workspace-shell.tsx:645), Cmd+Shift+Space. NO JKL, no I/O, no zoom keys, no ripple-delete, Home/End missing. Duplicate Delete handler in edit-tab.tsx:2104-area only clears selection (harmless dup) | Del/Backspace, Ctrl+D, Ctrl+Z/Y/Shift+Z, Ctrl+S, Alt+G/E/M (page:1157-1215), tool keys via toolMap (page:2514), arrows/Home/End (page:2218). `keyboard.js` is only `isTypingTarget` (17 lines, 2 tests) | n/a | (3) both; none tested for CineGen |
| Undo / redo | workspace reducer history, MAX_HISTORY 50, SET_TIMELINE debounced 300ms (workspace-shell.tsx:187-265); whole-workspace snapshots (assets/graph too) | page-local `undoStack/redoStack` snapshots (page:1071-1093) AND `timelineHistory.js` (169) used by timelineFeatureApi | n/a | CineGen (3) untested; classic (1) timeline-history.test.js 5 cases |

## 2. Keyframes / animation

| Capability | Where | Status | Export? |
|---|---|---|---|
| Data model (CineGen clip) | `Keyframe{time,property:'opacity'|'volume',value}` types/timeline.ts:82; ops add/remove/move + `interpolateProperty` timeline-operations.ts:682-755 (tested) | (1) but only 2 properties, linear only | opacity+volume YES via `kfToComposition` web-api.ts:56 -> clip.keyframes (easing dropped, linear) |
| Data model (CineGen fx/transform) | `ClipFx.keys` (openchatcut Keyframe{frame@30fps,value,easing}) clip-effects-section.tsx:59 (◆ button) ; transform keys clip-transform-section.tsx:52 + lib/occ/transform.ts (5 tests) | (3) key per-effect-slider; no dopesheet | YES: TimelineComposition MediaLayerBody samples `e.keys` per frame; transform via OccTransform (clipTransformCss) |
| Data model (classic/Remotion) | `clip.keyframes={prop:[{t,v,easing}]}` remotion/keyframes.js 160: props x,y,scale,rotation,opacity,volume, `fx:<uid>:<param>`; UI remotion/keyframesPanel.js 125 | (1) captions-keyframes.test.js (10) | YES (KeyframeWrap, effectOverridesAt, volume fn) |
| Legacy classic KeyframeSystem | keyframeSystem.jsx 604 (state.keyframeSystem, bezier, ANIMATION_PROPERTIES), keyframeEditor.js 769 (imported only by dead index.js), keyframeLanes.js 130 | (2) stored in `state.keyframeSystem`, NOT in `clip.keyframes`, so `timelineToComposition` never sees them: applied to DOM preview only (page:1653, 6781). Duplicate of remotion/keyframes.js | preview-only |
| Interpolation / easing | openchatcut/editor/keyframes.ts 205: linear, easeIn/Out/InOut, arbitrary cubic-bezier [x1,y1,x2,y2], exact bezier split on cut, `scaleKeyframes`. remotion/keyframes.js: linear, ease-in/out(quad+cubic), back, bounce, elastic, hold | (1) engine; the cubic-bezier path has no CineGen UI | yes |
| Easing presets | classic EASINGS (remotion/keyframes.js:25), `EASING_PRESETS` keyframeSystem.jsx:448 | (3) | classic yes |
| Bezier editor | `EasingCurveEditor` class animationControls.jsx:754 (exported, used? only via lib/editor/index.js re-export; page imports only interpolate/spring/etc.) | (2) no live consumer found | no |
| Dopesheet | keyframe-track.tsx 98 (CineGen: diamonds on clip for opacity/volume only, Delete key); classic `renderKeyframeLanes` (keyframeLanes.js 130) + diamonds page:2719 | (3) no multi-prop dopesheet | n/a |
| Auto-key | grep "autoKey|auto-key" -> none found | (4) | - |
| Spring | `spring()` animationControls.jsx:45 (used by page import, tests: animationControls.test.js 19); Remotion `spring` used in vendored remotionui scenes; no spring easing option in either keyframe model | (3) | only inside animation/code layers |
| Procedural drift/sway/breathing/spin/shake | overlay idle: pulse,bounce,flash,shake,swing,tada,wobble,rubberBand,jello,heartBeat,flip (remotion/overlayAnimations.js 133, overlays only, no tests); GL `fx-shake` (camera-shake.frag) per-clip; `noise2D/3D` animationControls.jsx:230. No drift/sway/breathing/spin as clip property | (3) shake+wobble/pulse only | yes for overlays + GL shake |
| Text per-char/word/line | captions: `word-pop`,`karaoke-pulse`, fade-up, pop (openchatcut/captions/captionMotion.ts 88, captionMotion.verify.ts not collected); vendored RemotionUI text-animator/text-split/typewriter primitives (src/lib/editor/remotion/remotionui/vendored/primitives|lib) selectable as animation layers; overlay text has only in/idle/out whole-box anims | (3) no per-char animation on SmartText overlay | captions+animation layers yes |
| Animated masks/crops | GL `fx-rect-mask`/`fx-circle-mask` (static props, keyable via fx keys); `flexCrop.ts` (173) / transform.fit/crop in lib/occ/transform.ts; no mask-path animation | (3) | yes (GL) |
| Animated effect params | CineGen: fx `keys`; classic: `fx:uid:param` keys | (1/3) | yes |

## 3. Lottie
| Item | Evidence | Verdict |
|---|---|---|
| Load | `@remotion/lottie` `<Lottie>` in StickerOverlay (kind 'lottie', URL/upload JSON via `useJson`, TimelineComposition.jsx:210-218), LowerThird, CTA | (3) works in export; no Lottie in CineGen UI except via overlays that reuse these addons |
| Colour/text customization | Generated Lotties only: `buildLowerThirdLottie` (addons/lowerThirds.js 379: text/colour/font fields), `buildCtaLottie` (addons/ctaLottie.js 324: label, colours, font; cta-lottie.test.js). Custom user Lottie: no colour/text override | (3) generated=yes+tests; arbitrary file=no |
| Dep | `lottie-web ^5.6.6`, `@remotion/lottie 4.0.540` in package.json | - |

## 4. Effects, colour, masks
Two independent effect systems (not interoperable, different project fields):
- A. Remotion effects (`@remotion/effects` 4.0.540): `clip.effects=[{uid,id,params,enabled}]`; generated catalog src/lib/editor/remotion/effectsCatalog.data.js 4243 (88 effects), loaders effectsLoaders.js, runtime effects.js; panel effectsPanel.js 210. CLASSIC ONLY (CineGen never writes `clip.effects`). Export: YES (descriptors on `<Video>/<Img effects>`). Tests: effects.test.js 9 (verdict 1).
  - Color (18): brightness, color-correction, color-key, contrast, curves, duotone, exposure, grayscale, hue, invert, levels, lut, saturation, shadows-highlights, thermal-vision, tint, vibrance, white-balance
  - Blur (6): blur, lens-blur, linear-progressive-blur, radial-progressive-blur, region-blur, zoom-blur
  - Distort (19): barrel-distortion, corner-pin, cylinder, fisheye, liquid-contours, mirror, noise-displacement, scale, shatter, shrinkwrap, skew, sphere, tear, tile, translate, turbulent-displace, wave, waves, zigzag
  - Stylize (17): burlap, chromatic-aberration, contour-lines, dot-grid, emboss, flannel, halftone, halftone-linear-gradient, lines, noise, outline, paper, pixelate, roughen-edges, scanlines, speckle, tv-signal-off
  - Light (10): bevel-alpha, drop-shadow, film-burn, glow, light-leak, light-trail, long-shadows, shine, starburst, vignette
  - Generate (10) and Reveal (8): checkerboard, fractal-noise, gridlines, linear-gradient(-tint), pattern, rain-fall, rings, snow-fall, white-noise; evolve, iris-wipe, linear/radial-progressive-pixelate, page-turn, pixel-dissolve, radial-wipe, venetian-blinds
  - Corner pin: `corner-pin` effect exists (params of type 'points'/'uv' via effectFields); no on-canvas pin handles (3).
- B. OpenChatCut GL pipeline (CineGen): `clip.fx=[{id,props,keys,enabled,def?}]`, `clip.lut`, `clip.blendMode`. Registry src/openchatcut/gl/fx/{shaderEffects.ts 489, lutEffects.ts 224, effects.ts 63, uniforms.ts 110, cube.ts 117}, runtime gl/runtime.ts 463, ClipFx.tsx 246. Export: YES (`occFx` -> `<OccClipFx>`; user .cube text and plugin defs travel in the model). Tests: occ-clip-fx.test.ts 18, gl.test.ts 15 (verdict 1).
  - Built-in FX (34, `builtin:fx-*`): luma-key, local-mosaic, magnify, rect-mask, circle-mask, crt, ascii-rain, shake, tilt-shift, chroma-key, color-wheels, levels, highlights-shadows, clarity, hsl-qualify, vignette, film-grain, rgb-split, glitch, bloom, pixelate, posterize, duotone, mirror, fisheye, kaleidoscope, edge-glow, soft-blur, light-leak, sepia, invert, halftone, motion-blur
  - LUT / looks (16): slog3-s709 + canon-log3-709 (real .cube, public/luts), 14 formula looks: teal-orange, mono, warm, cool, sunset, cyber, bleach, fuji-chrome/portra/velvia, ricoh-gr, kodak-gold, disposable, cinestill. User `.cube` import (lib/occ/user-luts.ts 50, cube.ts) and plugin packs (src/openchatcut/plugins/*, lib/occ/plugins.ts, tested occ-plugins.test.ts).
  - Chroma key: GL `fx-chroma-key` (chroma-key.verify.ts not collected) + `color-key` (A) -> (1) via gl.test/occ-clip-fx coverage claimed only for registry; per-shader correctness untested (3).
- Blend modes: CineGen `clip.blendMode` -> CSS `mix-blend-mode` in export (TimelineComposition clipBlend); classic overlays have `blendMode` + Blend Modes library (addons/blendLibrary.js 111, blend-library.test.js). Clip-level blend on classic video clips: `clip.blendMode` also mapped (timelineToComposition `clipBlend`). (1/3).
- Masks: CineGen/classic vector masks = only GL rect/circle mask fx. AI masks (SAM3 / on-device) in source-viewer-mask-tool.tsx 2296 and maskPreview.js 73 generate NEW mask/cutout assets (not live clip masks). Pen/bezier path masks: no UI (comment-only reference in keyframes.ts:2). Verdict (3) shapes, (4) pen paths.
- Colour scopes: classic colorScopes.js 126 (histogram RGB+luma, luma waveform, vectorscope; canvas draw; mounted in panel via mountColorScopesPanel page:6087; color-scopes.test.js 3 cases of computeScopes) -> (1) minus parade: RGB PARADE MISSING everywhere. CineGen: `clip-analyze-section.tsx` -> `scopesAt` -> openchatcut/color/scopes.ts 198 (numerical stats only: black/white points, clipping %, cast, hue bins - NO graphical scopes), auto-grade (autoGradeCore.ts 189). (3)
- colorCorrectionSystem.jsx 1452 lines: imported at page:70 but its init is commented out ("ColorCorrectionSystem not available", page:7012-7029; flag `colorCorrection:false` page:126) -> DEAD (2). Also re-exported from dead lib/editor/index.js.
- All preview-vs-export: classic Remotion effects and CineGen GL effects both burn into export; legacy `effectCompositor.js` 210 only used by EffectsStudio (different page).

## 5. Transitions
| Item | Evidence | Verdict |
|---|---|---|
| CineGen catalogue | 16 GLSL transitions (src/openchatcut/gl/transitions.ts 140; frags in gl/shaders/): cross-dissolve, dip-to-black, flash, luma-blend, soft-wipe, whip-pan, page-curl, rack-focus, organic-dissolve, impact-shake, anticipation-zoom, clean-line-wipe, circle-wipe, radial-blur, glitch-cut, dip-to-color + custom/plugin transitions (gl/customTransitions.ts 63). Labels are Chinese (ZH map, lib/occ/transitions.ts) resolved via openchatcut/i18n `t()` | (1) occ transitions in gl.test/occ-plugins; picker UI = clip-transition-section.tsx 55 (select + length slider; needs trim handles, `transitionHandle`) |
| CineGen export | `glTransitions` layer over A/B (TimelineComposition `GlTransitionLayer`; web-api.ts:184-194), GL shader burned in. Plain dissolve/fades not exported (see gaps) | (3) |
| Classic catalogue | `overlay-video-transition` addon (addons/overlayAddons.js:372), picker `VIDEO_TRANSITION_OPTIONS`: 10 Remotion-native + 125 gl-transitions names (overlayData.js:1239; `gl-transitions ^1.43.0`, shader loader addons/glTransitionRenderer.js 167 used by overlayRender.js:21 for the DOM preview only) | (3) |
| Classic export | `transitionMap.mapVideoTransition` (89 lines): ~30 exact mappings to @remotion/transitions presentations (fade, slide, wipe, flip, clock-wipe, iris, cube, push-cut) and 'gpu' ones (swap, crosswarp, dissolve, ripple, film-burn, cross-zoom, zoom-in-out, linear-blur, dreamy-zoom, book-flip) - but `presentationFor` ALWAYS uses the CSS fallback for gpu ones (TimelineComposition.jsx:353-357; HtmlInCanvas "experimental"). Remaining ~95 gl names map by keyword (`nearest`) to a CSS presentation or fade. exportWarnings.js tells the user "exports as X". So the GL look in preview != export. | (3) approximated; tested engine.test.js |
| Duplicate catalogues | classic `transitionsLibrary.js` 520 (Dissolve/Wipe/Push/Zoom/Iris/Star/Heart... ), `timelineTransitions.js` 435, `transitionEditor.js` 493 (4 tests) = a third legacy per-clip transition system (`clip.transition`); only used by page clip-editor (page:6770). Not mapped into timelineToComposition (`overlay-video-transition` clips are) -> export ignores `clip.transition` (2). `exportToVideo.js` carries `transitions[type,duration,clipA/B]` for the legacy worker path only | (2) |
| Registry extension point | CineGen: `GLSL_TRANSITIONS` (gl/transitions.ts) + `GlslTransitionType` (editor/transitionTypes.ts) + `GL_TRANSITION_ORDER`/ZH (lib/occ/transitions.ts) + plugin packs. Classic: `VIDEO_TRANSITIONS` (addons/overlayData.js), `EXACT` map in remotion/transitionMap.js, `PRESENTATIONS` in TimelineComposition.jsx |

## 6. Audio
| Capability | Where | Verdict | Export? |
|---|---|---|---|
| Clip volume | CineGen 0-2 slider (clip-properties-panel/clip-card gain drag clip-card.tsx:376); classic 0-1 | (1/3) | clamped to <=1 |
| Track volume / mute / solo | CineGen `Track.volume` applied in preview (playback-engine.ts:995-1041) | (3) | NOT exported (CineGen) |
| Master volume / bus | none (grep master in playback-engine: only a sync comment) | (4) | - |
| Fades | `clip.fadeIn/fadeOut` (openchatcut/editor/clipFade.ts) | (3) no tests for clipFade found | YES (`fadedVolume`) |
| EQ | none (grep BiquadFilter/equaliz: 0 hits in editor code) | (4) | - |
| Pitch / pitch-preserve | none; preview playbackRate default preservesPitch only | (4) | - |
| Meters | waveform-canvas.tsx 329 / waveform.ts 41 (peaks only); no VU/level meter | (4) | - |
| Sync | CineGen: `syncClips` timeline-operations.ts:842 (tested), adapters/main-process/audio-sync.ts 385, sync-audio-dialog.tsx, batch-sync-dialog.tsx, openchatcut/multicam/align.ts 152 (cross-correlation). Classic: audioSync.js 186 (audio-sync.test.js 12) | (1) | baked into positions |
| Ducking | classic only: `duckingKeyframes` agent/audioGen.js:130, `reduck()` agent/tools.js:561, music auto-duck (ai/music.js) -> writes volume keyframes (agent-created music tracks only). CineGen: `trackTypes.ts` anchor/follower ducking comment, no implementation | (3) classic / (4) CineGen | classic YES (volume keyframes) |
| Loudness / normalize / silence / beats | openchatcut/audio/{loudness 89 (simplified BS.1770, no K-weighting), silence, beats, vad, silero-vad, intelligence/*}; invoked in clip-analyze-section.tsx | (3) analysis only; .verify.ts not collected | baked gains |

## 7. Media management
| Capability | Where | Verdict |
|---|---|---|
| Scene detection | CineGen: `detectSceneChanges` lib/occ/analysis.ts (frame diff in hidden `<video>`, thresholds from openchatcut/scene/detect.ts 94) + "Split clip at N scene changes" (clip-analyze-section.tsx:55,124-129). Classic: components/timeline/SceneDetector.js 580 (panel `#sceneDetectorPanel`; thumbnail generation is a placeholder, line 555 "Generate a placeholder thumbnail") | CineGen (3) (verify-only tests); classic (2) partly stubbed |
| Scene browser | none beyond list of times | (4) |
| Filmstrip thumbnails | CineGen lib/editor/filmstrip.ts 106 + filmstrip-background.tsx 97; classic clipVisuals.js `drawFilmstrip` (:94) | (3) untested |
| Proxies | CineGen: `PlaybackProxyMode off/auto/on` in PlaybackEngine (setProxyMode :183; auto-fallback `onProxyFallbackRequest`), UI cycle button timeline-viewer.tsx:92; actual proxy generation callback lives in edit-tab/web-media (not traced). `proxy-toggle.tsx` 41 is an unused older component. Classic: clipVisuals `makeProxy` (:139, used by page `setProxyPlayback`:7320; `proxies` param of timelineToComposition, never for export; proxy-playback.test.js 10). `proxyGenerator.js` 119 (MediaRecorder-based) + `performanceManager.js` 615 are only reachable via dead lib/editor/index.js -> DEAD | classic (1); CineGen (3); proxyGenerator/performanceManager (2) dead |
| Relinking | no UI. Only `project.ts` types / cloud media mention missing media | (4) |
| Caching | playback-engine pooled video elements; classic clipVisuals peak/thumb caches; no render cache / frame cache | (3) |
| Captions / transcription | CineGen: `clip.captions` (openchatcut CaptionsData; 20+ style presets styles.ts; word-level, caption lane caption-lane.tsx, SRT import/export srt.ts; motion none/fade-up/pop/word-pop/karaoke-pulse); transcription via on-device Whisper (@huggingface/transformers 4.3.1) in web-api.ts `transcription.start`; export `occCaptions` YES. Tests: occ-caption-{cues,lane,srt}.test.ts. Classic: remotion/transcribe.js 87 + transcribe.worker.js (whisper-base/tiny timestamped), captions.js 167 (presets tiktok/classic/minimal/karaoke/box), CaptionsLayer in TimelineComposition (captions-keyframes.test.js), captionsPanel.js, subtitle*.js | (1) both |
| TTS | classic `smartSpeech.js` 97 + audioGen.js 160 (VOICES/OPENAI_VOICES, MuAPI/OpenAI gpt-4o-mini-tts BYOK; smart-speech.test.js); CineGen lib/occ/smart-speech.ts 42 wrapper; voice assistant realtime-voice.ts | (1) classic tests; CineGen (3) | audio clip placed on timeline -> exported |

## 8. Project save / format / version / recovery
| System | Detail | Verdict |
|---|---|---|
| Classic | src/lib/editor/persistence.js 655: envelope `{__version:2,__savedAt,data}` (`CURRENT_VERSION=2`, key `timeline-editor-project-v2`), localStorage -> IndexedDB (localforage/idb-keyval) -> Supabase fallback, MAX_VERSIONS 10 backups, restore(), v1->v2 migration, debounced autosave (page `debouncedSave`); zod schemas.js 352 (tolerant). projectLibrary/* UI (projectsPanel.js 338). timeline-history/state tests exist; persistence.js itself has no dedicated test found | (3) |
| CineGen | IndexedDB web-store.ts 400 (db `project.*`), `migrateSequenceToTimelines` timeline-migration.ts 131 (3 tests; patches missing clip fields), cloud sync lib/cloud/projects.ts 543, collaboration.ts 448, project-link.test.ts. No explicit schema version on the snapshot beyond migration heuristics; no recovery/backup UI found | (3) |
| Format mismatch | CineGen `Timeline` (seconds, flat clips) vs classic `tracks[].items[]` (% of timelineSeconds) vs Remotion model. Converters: web-api.ts export (CineGen->classic shape), lib/editor/timeline-bridge.js 401 (classic<->TimelineState), template-composition.ts. Bridge between CineGen and classic project files for edit/open: none found |

## 9. Dependencies (package.json)
remotion 4.0.540 and @remotion/{captions,effects,fonts,google-fonts,layout-utils,light-leaks,lottie,media,media-utils,motion-blur,paths,player,transitions,web-renderer,zod-types} all 4.0.540 (exact pinned); gl-transitions ^1.43.0 (classic only, via glTransitionRenderer.js; CineGen uses own GLSL), three ^0.187.0, gsap 3.14.2, lottie-web ^5.6.6, @ffmpeg/ffmpeg ^0.12.10 + @ffmpeg/util ^0.12.1, mediabunny 1.64.0, framer-motion ^11.18.2, zustand ^5.0.8, react ^19.2.7, @huggingface/transformers 4.3.1, vitest ^4.1.2, @playwright/test ^1.61.1. Not present: @remotion/gl, @remotion/three, @remotion/shapes, @remotion/noise, @remotion/animated-emoji (not in grep). node_modules not inspected (install possibly in flight). Note `@remotion/light-leaks`, `@remotion/motion-blur`, `@remotion/paths`: used by vendored remotionui/templates only (not traced to timeline UI). Remotion web-renderer runs under `licenseKey:'free-license'` (main.jsx).

## 10. Extension points for an integrator
| Need | File(s) to extend | Notes |
|---|---|---|
| New Remotion effect | scripts/generate-effects-catalog.mjs (regenerates effectsCatalog.data.js + effectsLoaders.js); effects.js (`fillRange`, `effectFields`) | generated; classic-only |
| New GL effect/LUT | openchatcut/gl/fx/shaderEffects.ts (`FX_EFFECTS`/`FX_ORDER`/`FX_IDS`) + a `.frag`; lutEffects.ts (`LUT_EFFECTS`); runtime `registerCustomFx()` in gl/fx/effects.ts; plugin packs (openchatcut/plugins) | auto-exported via `occFxList` in web-api.ts:20; plugin fx serialised as snapshot |
| New GL transition | openchatcut/gl/transitions.ts `GLSL_TRANSITIONS` + gl/shaders/*.frag; editor/transitionTypes.ts (`GlslTransitionType`, `GLSL_TRANSITION_TYPES`, labels); lib/occ/transitions.ts (`GL_TRANSITION_ORDER`, ZH labels); gl/transitionThumb.ts | export picks up automatically (glTransitions layer) |
| New classic/Remotion transition | addons/overlayData.js `VIDEO_TRANSITIONS`; remotion/transitionMap.js `EXACT`/`CSS_PRESENTATIONS`; TimelineComposition.jsx `PRESENTATIONS` + `presentationFor` (enable GPU path here) | |
| Keyframe schema | Classic/Remotion: remotion/keyframes.js `KEYFRAME_PROPERTIES`, `EASINGS`, `EASING_FNS`, `valueAt`; consumed in TimelineComposition (`KeyframeWrap`, `useLayerEffects`, `fadedVolume`). CineGen: types/timeline.ts `Keyframe` (union opacity|volume), timeline-operations.ts:682-755, web-api.ts `kfToComposition`; openchatcut/editor/keyframes.ts + clipTypes.ts (`KeyframeProp`, `KeyframeEasing`) for fx/transform | three schemas; unify before adding properties/easing |
| Clip / project schema | CineGen: types/timeline.ts (`Clip`, `ClipFx`, `Track`, `Timeline`), timeline-migration.ts, export-tab.tsx (what reaches export!), web-api.ts. Classic: lib/editor/schemas.js (zod), types.js 338, TimelineState.js, timelineEditorState.js, persistence.js (`CURRENT_VERSION`). Remotion: timelineToComposition.js (the model) + TimelineComposition.jsx | to add any per-clip property to export you must touch: Clip type -> export-tab.tsx map -> web-api.ts `item()` -> timelineToComposition `base` -> TimelineComposition |
| Overlay / addon registry | addons/registry.js 85 (`registerAddon`), overlayAddons.js, overlayData.js, runtime/addonEditor.js; Remotion side `OVERLAYS` map TimelineComposition.jsx:~330; CineGen overlay lane lib/occ/mg-templates.ts, hyperframes/overlay | |
| Animation catalog | src/lib/hyperframes/catalog.*.json (enabled 213 KB; manifest 863 KB; featureFlag.js 36, placement.js 44), src/lib/remotionui/{catalog,fields}.json + remotion/remotionui/loaders.generated.js, cinegen/lib/occ/animation-catalog.ts (groups; 267 library animations per comment) | generated loaders |
| Captions | openchatcut/captions/styles.ts (`CAPTION_STYLE_BY_ID`), captionMotion.ts; classic remotion/captions.js `CAPTION_PRESETS` | |

## 11. Duplicated systems & dead code
Duplicates:
- Two timelines/data models (CineGen `clips[]` vs classic `items[]` + `left/width%`), and `timeline-operations.js` (960) is a JS clone of cinegen `timeline-operations.ts` (997) (same function names/lines: getLinkedIds :13, addClipToTrack :73...) with separate tests (54 vs 76).
- Three effect systems: @remotion/effects (88), OCC GL (34 fx + 16 LUT), legacy effectCompositor.js/animationControls/CameraEffects.js (929).
- Three keyframe systems (see section 2). Three transition systems (OCC GL 16, classic gl-transitions 125 mapped to Remotion, legacy transitionsLibrary/transitionEditor).
- Two caption systems (classic captions.js vs OCC captions), two scene detectors, two proxy mechanisms, two scopes (graphical colorScopes.js vs numeric occ/color/scopes.ts), two undo stacks in classic (page-local + timelineHistory.js), two multicam (classic multiCam.js 90 PIP/split via Remotion boxes + panels/multiCamPanel.js; CineGen occ multicam-groups.ts angle decisions), `multiCam.js` vs `multiCamera.js` 274 (the latter only imported by timelineRendererEnhanced.js).
- Three renderers: timelineRenderer.js / timelineRendererEnhanced.js 946 / timelineRendererOriginal.js 244 (legacy DOM renderer, `timelinePlayback.js`).
Dead / stubbed (evidence):
- src/lib/editor/index.js: zero importers -> makes dead: keyframeEditor.js 769, performanceManager.js 615, proxyGenerator.js 119, SpeedRamping/MotionBlur/LayerParenting/EasingCurveEditor classes inside keyframeSystem.jsx/animationControls.jsx.
- colorCorrectionSystem.jsx 1452: imported (page:70) but init commented out (page:7012-7029), feature flag false (page:126).
- exportPipeline.js 482 + exportWorker.js 310: legacy MediaRecorder/WebM path, reachable only from "basic export" button; `exportToVideo.js` helper for worker data; tests only check data shaping.
- components/VideoEditorPage.js is a stub (own warning, line 11); src/components/timeline-editor/* only used by modals; proxy-toggle.tsx unused in CineGen (timeline-viewer uses cycle button); lib/cinegen.js / cinegenIntegration.js are MuAPI shims for the AI tools panel, not the editor; page:80-81 commented import of CineGenLayout.
- src/cinegen/__tests__/timeline-parity.test.ts compares against `apps/cinegen/src` (upstream copy, excluded from vitest at vitest.config.js 'apps/cinegen/**') - so the drift guard may silently skip if the copy is absent.
- `.verify.ts` files in src/openchatcut (22 files, e.g. fcpxml.verify.ts 546, chroma-key.verify.ts, rateStretch.verify.ts) are not collected by vitest; only openchatcut/__tests__/gl.test.ts (15 cases) runs. rateStretch.ts 53 (speed-ramp-ish retime) therefore untested in CI.
- OpenChatCut extras present in src/openchatcut but with no editor UI traced: tracking/* (template-match tracker; used for follow-subject via clip-zoom/transform), reframe/detect.ts, export/fcpxml.ts (FCPXML export; lib/occ/fcpxml.ts 32), transcript/edit.ts (text-based editing).
- Chinese-only strings in labels (transitions ZH map, FX names like '青橙电影感', many desc fields) pass through openchatcut/i18n `t()`; untranslated entries stay Chinese.

## 12. What takes effect in the Remotion export (summary)
YES: clip position/trim, constant speed (0.1-8x), volume<=1, volume keyframes, fades (CineGen), opacity keyframes, GL fx/LUT/blend, zoom/follow, transform (+tracked path), fill/fit, captions (OCC and classic), GL transitions (CineGen), Remotion transitions (classic; GPU ones fall back to CSS), overlays (text, image, sticker/Lottie, lower thirds, CTA, wrapper, text mask), HyperFrames/RemotionUI/MG code layers, Remotion effects (classic), classic keyframes (`clip.keyframes`), classic mute/solo, multicam PIP/split (classic).
PREVIEW-ONLY / NOT EXPORTED: CineGen track mute/solo/volume/visibility, volume >1, static opacity/flip, plain dissolve/fade transitions, markers, classic legacy `KeyframeSystem` keyframes, `clip.transition` (legacy transition editor), interactive add-ons (pause/loop/skip/lead-gen/list builder), proxy swaps (proxies never passed to export), SpeedRamping (no consumer).
