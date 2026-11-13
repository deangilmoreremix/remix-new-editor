# HyperFrames in the Timeline Studio Editor (flag-gated, additive)

> **Reliability, components and starter projects pass (latest; supersedes counts further down).** Matrix: `docs/hyperframes-compatibility-matrix.md`; per-resource ledger: `docs/hyperframes-resource-ledger.md/.csv`; evidence: `docs/evidence-hyperframes/`.
>
> | Item | Result |
> |---|---|
> | Enabled for customers | **118** = 69 blocks + 48 components + 1 starter project (ON for everyone) |
> | Blocks | 210: 114 verified (84 + 30 recovered by generic adapter fixes) = 67 enabled + 47 held back (exact blocker per id in the ledger); 19 adapter-compatible, 25 specialized, 50 unsupported, 2 not-tested |
> | Components | 238: 80 verified vs native HyperFrames, 37 host-dependent (blank standalone), 57 adapter-compatible, 62 specialized, 2 adapter errors; **7 enabled** (beat-accent, chat-message, conic-progress-ring, hw-arrow, hw-box-label, text-shimmer, yt-circle-pointer); 56 verified ones are held for browser-export throughput (4-8 fps at 1080p), 19 for blank standalone output, 17 for no measured editable effect |
> | Starter projects | 9: 3 verified vs native (decision-tree, nyt-graph, product-promo); **1 enabled (product-promo, 12.2 fps, full-scene template, exported in the real editor)**; decision-tree/nyt-graph held for throughput (6.7/6.9 fps); play-mode, swiss-grid, vignelli, warm-grain adapter-compatible (SSIM 0.88-0.94: unfilled `__VIDEO_SRC__` footage slot and caption layout differences); kinetic-type unsupported (remote S3 image not pinned); path-traced-3d unsupported (WebGL path tracer, no timeline) |
>
> **Two separate off-switches** (`src/lib/hyperframes/featureFlag.js`): *catalog disable* (flag off, or ids in `catalog.disabled.json`) hides animations from the library only; *emergency runtime disable* (`VITE_HYPERFRAMES_RUNTIME_DISABLED=true` or localStorage `remix.hyperframes.kill=1`) stops every HyperFrames script in preview and export. Saved overlays are never deleted or rewritten by either; the preview shows a toast and an export containing HyperFrames layers is refused (fail-closed). Verified in a real browser (`modes-*.json`).
>
> **Customer-visible errors**: adapter problems travel over the existing code-layer error bus (`[hyperframes:error]` / `[hyperframes:note]` prefixes) to the editor's existing toast (`cinegen:hyperframes-notice` event handled in `workspace-shell.tsx`); fatal problems (refused/tampered file, failed script, missing timeline, blocked asset, runtime disabled, unavailable block) make the export fail with a message instead of producing an apparently fine MP4 (`export-runner/main.jsx` `hfErrors`, `exportClient.js`).
>
> **Adapter** (generic, no per-item code): nested compositions (`data-composition-src`, absolute/relative `data-start` incl. clip references, `data-duration`, `data-playback-rate`, `data-media-start`, instance `data-variable-values`, per-composition timeline seeking, composition roots sized from `data-width/height`, project-relative assets, pinned child files only), generated host composition for components, `<template>` and `<head>`-style files, `var CONFIG` and declared-variable overrides, `document.currentScript` stand-in, protocol-relative script URLs, unfilled footage slots, empty/static compositions accepted, blank-vs-blank SSIM guard.

> **Completion pass (supersedes the counts below where they differ).** Full matrix: `docs/hyperframes-compatibility-matrix.md`. Evidence: `docs/evidence-hyperframes/`.
>
> | Item | Result |
> |---|---|
> | Blocks enabled for customers | **49** (86 verified; 41 adapter-compatible; 32 specialized; 51 unsupported) |
> | Editable fields exposed | 214, each one measured to change the rendered output |
> | Components verified against a native reference | **0** of 238 (146 render and animate in the production path, 53 static, 34 adapter errors, 5 blank; none enabled) |
> | Starter projects verified | **0** of 9 (not enabled; need a nested-composition loader, 5 use `<video>`/`<audio>` placeholders, 1 is a WebGL path tracer) |
>
> What changed in the adapter (all generic, no per-block code): `var CONFIG = {...}` overrides (`cfg.<path>`), declared composition variables (`var.<id>`, `data-var-text`/`data-var-src`, `__hyperframes.getVariables()`), `<template>`-wrapped compositions, vendored fonts inlined as data URLs (sandbox CSP), script elements removed from the mounted DOM, block-local `gsap` copies treated as bundled, adapter errors surfaced with `console.warn("[hyperframes] ...")`. `gsap@3.14.2` is now an exact-pinned dependency in `package.json` (it was previously an undeclared import that the dev build silently stubbed).
>
> Corrections to earlier reporting: (1) "32 blocks failed MP4 export" was a classification bug: 31 of them were never exported (their SSIM was < 0.85, so they are `specialized`), 1 real export timeout; (2) 12 blocks were blocked for "remote images" because of `<link rel=preconnect href=fonts.gstatic.com>`; the manifest builder now ignores preconnect links; (3) `lower-third-bild`, `share-sheet-carousel`, `split-flap-board`, `freeze-frame-dressing` were removed from the enabled list because their built-in text cannot be edited, or edits had no measured effect, or the production-path render differed from native (SSIM 0.823).

Status: integration branch `claude/hyperframes-timeline-integration`, based on `origin/claude/confident-fermi-3azaem` (d50eeb167). Merged to develop (PR #90). **ON for everyone** (see "Feature flag").

## Feature flag and rollback
- ON by default. Hide it in one browser (QA): `localStorage['remix.hyperframes.v1']='0'`. `VITE_HYPERFRAMES_TIMELINE` is no longer read. Emergency off for everyone: `VITE_HYPERFRAMES_RUNTIME_DISABLED=true` (build) or `localStorage['remix.hyperframes.kill']='1'`.
- The flag only controls the library entry point ("HyperFrames animations…" in the overlay lane's add menu). Without it the editor is unchanged (verified: flag-off export matches the pristine build, see below).
- Rollback: unset the env var / remove the localStorage key and redeploy; no data migration. Hard rollback: revert the branch (all changes additive). Projects that already contain `hyperframes` overlays keep them in `project.json`; older builds drop unknown overlay kinds via `normalizeOverlays` (they are not corrupted).

## Catalog (pinned)
- Upstream `heygen-com/hyperframes` @ `cda84222aa12716f2ceb92b45629487be81a0601`, Apache-2.0, hyperframes 0.9.28. Manifest: `src/lib/hyperframes/catalog.manifest.json` (457 items: 210 blocks, 238 components, 9 starter projects; per-file sha256, scripts, fonts, features, remote asset URLs, licence info). Rebuild: `scripts/hyperframes/build-catalog.mjs --upstream <checkout>`.
- Classification (`catalog.classification.json`, generated by `scripts/hyperframes/classify.py` from measured evidence: stills at 3 times, SSIM vs native HyperFrames snapshot, MP4 export):

| Type | verified-export | adapter-compatible | unsupported | not-tested |
|---|---|---|---|---|
| blocks (210) | 88 | 40 | 82 | 0 |
| components (238) | 0 | 0 | 0 | 238 |
| starter projects (9) | 0 | 0 | 0 | 9 |

  Unsupported reasons (blocks): 40 no seekable GSAP timeline (shader/WebGPU blocks), 32 MP4 export failed, 7 script failed, 2 blocked host, 1 mount failure.
- **Enabled for customers: 30 blocks** (`catalog.enabled.json`): verified-export AND no WebGL/three.js/WebGPU/HTML-in-canvas/audio/video/sub-composition/unseeded random/infinite repeat/remote images, export >= 8 fps, >= 1 editable field. 58 verified blocks were held back for having no detected editable field, 22 for WebGL, 7 three.js, 12 remote images, 8 for throughput < 8 fps, others for audio/video/sub-composition/random/HTML-in-canvas.
- Vendored only for the 30 enabled blocks into `public/hyperframes/blocks/` (1.1 MB, every file sha256-checked, GSAP 3.14.2 vendored in `_cdn/`, no CDN at render time). `scripts/hyperframes/vendor-enabled.mjs`.

## How it plugs in (existing patterns only)
- New overlay kind `hyperframes` next to `mg-template` (same modal → ADD_OVERLAY → sandboxed preview frame → export `hfOverlays` path). Inspector reuses `MgPropsEditor`. Start/End, move/trim/delete use the existing overlay lane.
- Rendering: Remotion layer `kind:'hyperframes'` (`HyperframesLayer.jsx` → `BlockClip.jsx`), seeked by the Remotion clock (GSAP timeline `seek`), captured by `@remotion/web-renderer` inside the existing opaque-origin export frame. Personalization uses a sparse HyperFrames `OverrideSet` (`<hf-id>.text|.style.<prop>|.attr.src`), master HTML never modified. Upstream HTML has no `data-hf-id`; deterministic ids `hf-<n>` are stamped in document order on the sha256-verified master (`stampHfIds`).
- Persistence: `workflow.overlays[]` entry `{type:'hyperframes', blockId, hfSchema:1, props, ...}` in the existing project store.

## Security (what is and is not claimed)
Only catalog ids in `catalog.enabled.json` load; id regex; fetched bytes verified against pinned sha256; scripts only run inside the sandboxed opaque-origin frame; asset URL allow-list, colour/text validation, inline handlers stripped, remote script fetch blocked. Unit-tested; **not** an independent security audit.

## Evidence (real browser, flag ON, new editor)
`docs/evidence-hyperframes/`: library search + add (08), three overlays incl. two instances of one block (08b), reload persistence (10), exported frames (`f2.png` 720p, `m3.png` 1080p), 720p MP4.
- 720p MP4 with one customised overlay: H.264 1280x720, AAC, 255 frames, overlay with edited text visible over footage.
- 1080p MP4 with three overlays (2x Clean Bar, Neon Border): H.264 1920x1080, 255 frames; instances independent.
- Reload: overlay and edited text persisted (project store). Note: re-exporting after a reload in an ephemeral test profile failed because the imported media blob URL was gone (existing editor behaviour, unrelated to HyperFrames).
- Flag OFF: overlay menu shows only "+ Add overlay…"; export vs pristine build SSIM 0.9886 mean, identical to pristine-vs-pristine run-to-run noise (0.9886).
- Full vitest: pristine 193 failing / 8 files; integration 193 failing / same 8 files, 0 new failures, +15 passing tests.

## Limitations
Components (238) and starter projects (9) not integrated; 40 adapter-compatible blocks (SSIM 0.85-0.95) shown as not offered; WebGL/three/WebGPU excluded; nested compositions, composition variables (`data-composition-variables`), playback rates, media offsets not implemented; no duplicate-overlay action; Firefox/WebKit not tested; A/V sync with HyperFrames audio not tested (audio blocks excluded); long repeated-export soak not done; saved project opened with flag OFF not tested in a browser.

## Completion-pass results

### Saved projects / flag / repeated exports (real browser, flag ON then OFF then ON)
- Project with 3 overlays (2x Clean Bar with different text, Neon Border with start 1 / end 4): all overlay ids, `blockId`, `props`, start/end persisted in the project record after reload.
- Flag OFF: "HyperFrames animations…" entry gone; the 3 overlays still present with identical data and still render in export (SSIM 0.9875 vs the flag-on export). Flag ON again: data unchanged. Four consecutive exports without re-importing media: SSIM 0.9875-0.9877 vs the first export.
- Footage after reload: the editor stores a media file as a durable URL only when `uploadFileToStorage` (Supabase storage) succeeds (`src/cinegen/adapters/web-media.ts: durableUrl`); when upload is unavailable (offline / unconfigured storage, as in the test sandbox) it falls back to a session-scoped `blob:` URL that dies on reload. This is existing behaviour of the editor (the pristine build behaves the same), not related to HyperFrames, and customers with working storage keep their footage. Persistence tests therefore used a test-harness route that emulates storage (no app code changed). Not changed in this branch.

### Security review (what was tested)
Real-browser negative tests through the actual sandboxed preview frame (`security-negative-tests.json`): tampered block file refused (sha256 mismatch), non-allow-listed host / `javascript:` URL / disallowed style property rejected, `__proto__` config path rejected, HTML and script payloads in text overrides rendered as inert text, config strings treated as JSON data (no payload executed, no `postMessage` escaped), invalid or unlisted block ids render nothing. Unit tests: validators, config patching, variable resolution.
Outside this testing: no independent audit, no fuzzing, no WebGL/GPU isolation analysis (excluded by policy), no server-side concerns (none added), supply-chain review of GSAP beyond the exact version pin, behaviour of non-Chromium browsers.
Browsers: only Chromium is installed in this environment; Firefox and WebKit are **not tested**.

### Regression (flag OFF/ON vs pristine `d50eeb167`)
- Full vitest: pristine 193 failing tests / 8 files; integration identical failing set, 0 new failures, +25 passing tests.
- Flag-off Timeline Studio export vs pristine: SSIM 0.98865 (pristine vs pristine 0.98864). Edit-tab screenshot after import: 0 differing pixels (>24). Classic editor route (`#/timeline-classic`): 0 differing pixels.
- Flag-on exports: 1080p with three overlays (2x Clean Bar, Neon Border) H.264/AAC, 255 frames.
- Not re-run in this pass: keyboard-shortcut walkthrough, LUT/effect/transition library walkthrough, captions and audio tool walkthrough (no code in those areas changed; covered only by the unchanged test suite and the screenshot equality above).

### Performance
Production-path stills: 50 blocks rendered (~6 s each in the sandboxed frame including mount). Export throughput of enabled blocks was >= 8 fps in the research harness (policy gate); the 8 blocks below that are not enabled.

### Remaining blockers for production
Components and starter projects not integrated; no native-reference verification for components; Firefox/WebKit untested; remaining unmeasured editable fields (119 of 292 measured edits showed no visible change at the three sample times, so they are hidden rather than shown); no visible in-editor compatibility warning when a block reports an adapter error (errors go to console only); footage durability depends on storage upload (pre-existing); WebGL / three.js / WebGPU excluded.

## Reliability, components and starter projects: results

### Saved projects, flag modes, repeat exports (real browser)
- 3 overlays (2 instances of one block + another): after reload, with the emergency kill switch on, back off, after catalog-disabling one id, and after editing an overlay post-reload, every overlay id/blockId/props/start/end stayed identical (`modes-persistence-reload.json`). With the kill switch on the preview shows the toast; with the catalog disable the library hides the id while the saved overlays still render.
- Fail-closed exports (`modes-export-failclosed.json`): normal export OK; kill switch on -> export stopped with message + toast, no MP4; after switch off -> OK; network-tampered block -> refused (sha256) with message + toast; restored -> OK; 3 repeats OK.
- Component + starter in the editor (`modes-component-starter-export.json`): Hand-Drawn Arrow + Product Promo over footage, 720p, 20 s, 600 frames H.264 + AAC; repeat export SSIM 0.9999.
- Memory (`memory-repeat-export.json`): 12 consecutive 90-frame 1080p exports in one page: 6.7-7.7 s each, browser RSS flat at 1.15-1.38 GB, no growth.
- Footage lost after reload is existing behaviour (see earlier section); tests with media avoid reload, tests with reload use overlays only.

### Evidence rules used for enabling anything
SSIM >= 0.95 at every sample vs a native HyperFrames snapshot (pinned CLI 0.9.28) rendered through the PRODUCTION sandbox; native reference must not be blank; zero adapter errors; policy features clean (no WebGL/three/WebGPU/audio/video/unseeded random/remote assets); real MP4 export in the production export runner at >= 8 fps (1080p, serial); at least one editable field whose edit visibly changes the render, or an output that is visibly non-blank with nothing customer-specific. Static components are classified by SSIM only; they are not penalised for lacking motion (`kind: static|animated` is recorded).
Things this caught: blank-vs-blank false verification (editorial-flash-overlay, caption components, 37 host-dependent components), text-only edits that did nothing, export failures only visible in a real export (caption-texture: renderer limitation for URL masks; text-stagger: page crash), a harness bug and a silent nested-file failure that was not reaching the customer.

### Security (production-path tests; not an independent audit)
Tampered block, tampered component, tampered nested scene file (all refused, shown to the customer, export fails); `javascript:`/off-allow-list URLs, disallowed CSS properties, `__proto__` and injected config/instance-variable values (rejected or treated as data); script/HTML payload text rendered inert; nested paths limited to the pinned file list (`normalizeRel` rejects `..`, schemes, absolute paths; depth <= 4, <= 60 nested clips); two instances and different animations in one timeline independent. Outside scope: external audit, fuzzing, GPU/WebGL isolation, non-Chromium browsers (only Chromium available here: Firefox/WebKit NOT TESTED), network/CDN supply chain beyond vendoring + hash pins.

### Regression
Full vitest: pristine 193 failing / 8 files; integration 193 failing in the same 8 files, 0 new failures, +40 passing tests. Flag OFF vs pristine: identical walkthrough observations (effects 34 options / 33 library cards, LUTs 16, transitions 16, clip/overlay menus, space/delete/undo/redo), export SSIM 0.9886 (= pristine-vs-pristine noise), classic editor route 0 differing pixels (earlier run). Flag ON differs only by the added "HyperFrames animations…" menu entry. Not exercised in this pass: captions and audio tools beyond the unchanged test suite and the matching library/menu observations.

### Remaining production blockers
- Export throughput: most components and 2 starters render at 4-8 fps at 1080p in this environment (held back, not hidden); real customer hardware may differ.
- Only Chromium tested; footage durability depends on storage upload (existing behaviour); WebGL/three.js/WebGPU items stay disabled; 4 starters need a footage slot / caption layout work; kinetic-type needs asset pinning; unmeasured editable fields are hidden.

## Viewing it on a preview deploy
The library is on by default: the Edit tab's "Add overlay…" menu shows "Animations…". Emergency off: `localStorage.setItem('remix.hyperframes.kill','1')`.

Preview build trigger note: PR #90 now targets develop so Netlify builds a Deploy Preview.


## Update: export-speed rule relaxed (8 fps -> 3 fps), 25 more animations
Items that were verified (SSIM vs native HyperFrames >= 0.95, real browser export OK) and blocked ONLY by the 8 fps export rule were re-checked with `scripts/hyperframes/enable-slow.py`:
fresh production-path renders (no adapter error, not blank), a measured visible effect for at least one editable field (69 of 154 fields tested had one), and a real full-length 1080p
browser MP4 export. 25 of the 55 qualified (all 25 exported; 3.3-14.6 fps) and were added; 7 of them export under 8 fps and are labelled "slower export" on the card. The other 30 stay held back
because they would show built-in text/content a customer cannot change (or, for `message-thread-reveal`, export at 1.8 fps). Existing enabled items were not touched.


## Update: components shown through their own demo composition (+32), `hf-seek` support
Every component ships a `demo.html` (a complete composition that shows it in context). `scripts/hyperframes/demo-records.py` pins it by sha256 (plus the component file it mounts) and
`vendor-enabled.mjs` vendors it under `public/hyperframes/component-demos/<id>/`. This is the "larger scene" that host-dependent primitives (text effects, captions, transitions) need, and it is what
native HyperFrames renders too, so the native reference is the same demo (`native-refs.mjs`, type `demo`). Evidence for all 208 non-enabled components: production-path render + SSIM vs native
(`compare-demos.py`), editable-field effect measurement, real full-length 1080p exports, then `enable-demos.py` applies every gate. Result: **32 promoted**; of the 208, 95 matched native at >= 0.95, 113 did not
(real adapter differences, not yet diagnosed). Items shown through a demo address the component's variables via the mounting element (`project.instance`).
Adapter changes: remote scripts that are vendored (e.g. GSAP plugins) are now fetched from the shared vendored folder when a nested/demo file asks for them; `hf-seek` listeners are kept per instance and called on every seek
(HyperFrames' protocol for non-GSAP content). The `hf-seek` path is **experimental**: WebGPU is available in the sandboxed frame and the shader library builds and receives seeks, but the canvas stayed black in the
headless test browser (software GPU), so no WebGPU/WebGL shader block is enabled through it.

### Correction: items that show text a customer cannot change were removed (-15)
The 14 `caption-*` demos and `halftone-dissolve` declare no (effective) variables but show built-in text, and had been let through as "ready to use" because the leaf-text probe found nothing. They are held back again
(`shows built-in text that cannot be edited`). The other five no-field items (`magnetic-cursor`, `sticky-mock-swap`, `stagger-lattice`, `svg-line-draw-loader`, `yt-feather-highlight`) were checked by eye: no text.

### Update: inline variable declarations, nicer library cards (118 HyperFrames + 149 RemotionUI = 267)
Compositions that mount their component inline (component demos) declare the variables on the inner element; `BlockClip` now resolves customer `var.*` overrides against that element when the root declares none (this made 29 of 38 fields of 11 re-tested components visibly effective).
Eight components that looked like a tiny element in a corner when shown alone (`avatar-group-hover`, `menu-morph`, `matrix-decode`, `per-word-crossfade`, `perspective-marquee`, `tabs-slide-indicator`, `top-down-letters`, `input-feedback`) now use their own demo scene; `badge-pop` was added. Hover previews of all 266 then-current cards were checked in the real library modal.


## Update: placement of animations (lower thirds fix)
Every animation (HyperFrames and RemotionUI) can now be placed in the frame: **Fit** (inside the frame / fill the frame / match width and sit at the bottom), **Left/right** and **Up/down** offsets (% of the frame), **Size** (%), plus a "Move" handle and a corner resize square on the video, "Reset position" and "Extend to end of video" in the settings panel.
The overlay stores `geom: { x, y, scale, fit }` (optional; overlays saved earlier render as before). One function, `src/lib/hyperframes/placement.js`, is used by the preview, the handles and the export, so what you see is what is exported.
Lower thirds and tickers default to `width-bottom`: they stay on the bottom edge in 16:9, 9:16 and 1:1, and are enlarged up to 2.2x in narrower frames so they are not tiny on a phone-shaped video (verified by a real 1080x1920 MP4 export, default and moved/resized).
Lower thirds also got customer-facing field names and neutral starting text ("Your name", "Your title", a neutral avatar) from `src/lib/hyperframes/labels.json` (the master text stays the default; a new clip starts with the neutral text), and 640x360 thumbnails rendered over a video-like backdrop.
Note: `lower-third-bild` is enabled (the earlier note that it was removed is out of date).

## Update: blocks that ship their own folder (Stage 3, first fix)
Eight blocks (`canopy-part-title`, `code-slice-hero`, `cuboid-carousel`, `frost-sequence-camera-orbit`, `glass-shard-title`, `lottie-character-walk`, `orbit-card`, `wireframe-portal-title`) keep their html and assets together in `compositions/<id>/`, but the vendoring put the html at `blocks/<id>.html` and the assets elsewhere, so scripts referenced as `assets/...` returned the app's HTML page ("Unexpected token '<'"): that was the real cause of several "script failed" classifications, not the blocks themselves.
`eval-enable.py` now records such blocks as pinned **projects** (`project.folder`, dir `blocks/<id>`), `vendor-enabled.mjs` copies the folder with its layout (sha256 per file), and `native-refs.mjs` has a `block-folder` type. Re-measured against native HyperFrames (production-path SSIM, real 1080p export, field effects): `code-slice-hero` passes every gate and is now **enabled (119 HyperFrames items)**; `orbit-card` (0.943) and `cuboid-carousel` (0.81-0.94) are close but below 0.95; `glass-shard-title` and `lottie-character-walk` render but no field visibly changes the picture (blank/off-sample); `canopy-part-title`, `wireframe-portal-title`, `frost-sequence-camera-orbit` do not match native.
Finding: headless Chromium here runs **WebGL** (software), so WebGL/three.js blocks CAN be verified (`enable-blocks.py` allows them when SSIM >= 0.95 and a real export succeeds); **WebGPU** blocks cannot (no real GPU), so they stay held back.


## Stage 3, part 2: GSAP pilot (4 blocks reported "no timeline")
The four non-shader blocks reported as having no seekable timeline (`code-snippet-dark-2026`, `code-snippet-dark-modern`, `thread-message-stack`, `vfx-iphone-device`) were re-run through the production path. The adapter was not the cause: the three GSAP blocks mount and seek correctly. `vfx-iphone-device` still fails (its 3D model files are not vendored). The native HyperFrames render of the other three is blank here, so SSIM cannot be computed; they were checked visually instead (documented exception, `visualReview: true` in the classification).
- **`thread-message-stack` is enabled** (library 120 HyperFrames items): 7 editable fields (6 message texts + the first sender), all measured to change the picture; real 1080p export 13.2 fps.
- New editing path for blocks that keep their text in a declarative JSON blob (`data-hf-primitive-data`): override key `data.<path>` (e.g. `data.messages.0.text`), validated like `cfg.*` (path allow-list, text/number only, no new keys, type must match) and patched into the JSON text before the block's scripts run (`patchDataBlob` in `config.js`). Element text edits are also re-applied after the block's scripts ran, so a title that a script writes from its own theme object stays editable.
- **Held back:** both code-snippet blocks. Title/eyebrow/theme-file/window-title fields work (visible effect measured), the code body and file tree are fixed sample text, and the real export runs at 1.6 fps (< 3 fps minimum).
- Library thumbnails (`public/hyperframes/thumbs/*.jpg`) were git-ignored by a global `*.jpg` rule, so they were missing on the deployed site (the URL returned the app shell). They are now tracked.
