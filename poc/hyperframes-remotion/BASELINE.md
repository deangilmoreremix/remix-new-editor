# Baseline record (taken before any app change; capture-only)

Base commit of this branch's app code: `3c9134e3`. `git diff --name-only 3c9134e3 HEAD` lists **0 files outside `poc/hyperframes-remotion/`**.
The new editor was captured from a throwaway `git worktree` of `origin/claude/confident-fermi-3azaem` (head `c480f3ecb`, not in production; nothing was committed or pushed there).

## Which editor is which (verified in `src/lib/router.js` on each branch)
| Branch | `#/timeline` | `#/timeline-classic` |
|---|---|---|
| this branch (`claude/vigilant-noether-rcasf7`) | classic `TimelineEditorPage.jsx` ("SmartVideo AI Timeline Editor") | not defined |
| `origin/claude/confident-fermi-3azaem` | **new** "Timeline Studio Editor" (vendored CineGen, `src/cinegen/`) | classic editor |

## Regression tests (unmodified code, `npx vitest run`)
| Branch | Files | Tests | Pre-existing failures |
|---|---|---|---|
| this branch (classic) | 446 passed / **5 failed** (451) | 7974 passed / **5 failed** / 32 skipped | `src/test/react-settings-modal-api.test.js`, `src/test/protected-upload-baseline.test.ts` (TimelineEditorPage.jsx hash), `src/lib/editor/addons/__tests__/blend-library.test.js`, `src/features/personalization/apps/motion-director/__tests__/legacyCards.test.ts`, `netlify/functions/_personalization/tests/upload_file.vitest.test.ts` |
| new-editor branch | 448 passed / **7 failed** (456) | 6844 passed / **193 failed** / 52 skipped | `tests/acceptance/all-template-production.spec.ts` (165 tests, "required media validation works"), `tests/unit/timeline-muapi-generation-service.unit.spec.ts` (25), `tests/unit/template-contract.unit.spec.ts` (2), `src/test/protected-upload-baseline.test.ts`, two `tests/visual/*.spec.ts` and two `tests/integration/*.mjs` files (collected by vitest but meant for Playwright / Node) |
| new editor only (`npx vitest run src/cinegen`) | 169 passed | 1247 passed / 27 skipped / 0 failed | none |
| classic subset run earlier (`src/lib/editor/remotion`, `src/lib/editor/__tests__`, personalization `webExport*`, `finalOutput*`) | 38 passed | 455 passed | none |

All of these fail or pass identically with or without this PoC, because nothing in the app imports `poc/`. `protected-upload-baseline` reports `PROTECTED FILE MODIFIED: src/components/TimelineEditorPage.jsx` on both branches without any of this work, so it is a pre-existing failure.

## Screenshots (`out/baseline*/`, generated, not committed)
- Classic `#/timeline`, desktop 1440x900: first-run "set up your API keys" modal, then the editor after dismissing it (`out/baseline/timeline-desktop-modal.png`, `timeline-desktop.png`), control inventory in `out/baseline/controls.json`. Console errors observed: missing Supabase/Clerk/MuAPI env vars (environment, not code).
- Classic `#/timeline` at 390x844: blank grey page, 0 body text. **Not investigated**; recorded as observed.
- New editor: Project Manager (empty state), new-project form, workspace, and all six tabs Elements, Spaces, Director, Edit, LLM, Export (`out/baseline-new/*.png`, `capture-log.json`). Edit tab: media pool, viewer, transport, tracks (Video 1, Audio 1), "+ Add overlay..." lane. Export tab: Draft 720p / Standard 1080p / High 4K, 24/30/60 fps, aspect, bitrate, Render, FCPXML, interactive share. 0 page errors.

## Export pipeline (read from source; both exports then verified below)
- Classic editor: `timelineToComposition()` model -> `exportClient.js` -> sandboxed `export-runner` iframe -> `renderMediaOnWeb` (WebCodecs), download as blob.
- New editor: `src/cinegen/adapters/web-api.ts` `export.start` builds the same model with the same `timelineToComposition.js` and `exportClient.js`, so it also renders in the browser with no FFmpeg and no server. Its Export tab then runs an in-browser QA pass.

## Accepted baseline: new Timeline Studio Editor export (VERIFIED)
Sample media: a 6 s 1280x720 clip built from the images you attached (3 images x 2 s) plus a beep every second at 1,2,3,4,5 s. No API key was needed. Both exports below use Draft 720p, 30 fps, H.264 + AAC, and the editor's own export check ("Export check: 0 errors, 3 warnings": still/frozen spans, expected for still-image media; audio peak -2.1 dBFS).

| | Run 1: clip dropped at about 0.5 s | **Run 2: clip at exactly 00:00:00 (clean timing reference)** |
|---|---|---|
| File | `evidence/new-editor-export-720p.mp4` | `evidence/new-editor-export-720p-at-zero.mp4` |
| Result | 1280x720, 195 frames, 6.5 s | 1280x720, **180 frames, 6.000 s**, AAC 6.016 s |
| Audio beeps (source: 1, 2, 3, 4, 5 s) | 0.5, 1.5, 2.5 ... (shifted by the 0.5 s placement) | **1.00002, 2.00002, 3.00002, 4.00002, 5.00002 (identical to source)** |
| Image boundaries (source: 2.0 s, 4.0 s) | 2.5 s and 4.5 s | **2.0 s and 4.0 s (SSIM across the boundary 0.66 and 0.15)** |
| Conclusion | audio and video shifted together, in sync | audio and video match the source exactly |

Placement method for run 2: the clip is dropped on Video 1, then dragged left so the editor's Snap pulls its start to the timeline origin (screenshot `evidence/baseline-new-import-02-after-drag-at-zero.jpg` shows the clip starting at the timeline origin).

## Classic editor: PARTIALLY VERIFIED
- VERIFIED: loads at `#/timeline` (this branch); desktop screenshots, control inventory, and a real export through its own pipeline (Export dialog: MP4/WebM, 720p/1080p/4K) producing `evidence/classic-export-720p-empty.mp4` (1280x720, H.264, 1350 frames, 45.0 s, AAC 45.01 s). That export is of the built-in 45 s **placeholder project with no media** (the dialog says "the background will be black").
- NOT TESTED: an export containing real media, and import of the sample clip, because of two **pre-existing development-environment issues** that this work did not cause and did not change:
  1. `src/lib/media-worker-manager.js` fetches `./lib/media-worker.js`, a file that **does not exist in this repo**. The dev server answers with its HTML fallback and the blob worker dies with `SyntaxError: Unexpected token '<'`. The repo's own `e2e/upload-boundary.spec.js` and `e2e/studio-upload-coverage.spec.js` document this and stub the file.
  2. `MediaInfoModule.wasm` is requested from `/node_modules/.vite/` and is also answered with HTML in dev, so media metadata cannot be read.
- Applying the repo's own e2e stub for issue 1 was done only through Playwright request interception in the capture script, never in app code. No workaround was added to any production file.
- Also unverified there: 390 px width renders a blank page (not investigated).

## SmartVideo GO API-key error: separate, not diagnosed
The SmartVideo GO "Welcome" dialog showed `Unexpected token '<', "<HTML> <HE"... is not valid JSON` after entering MuAPI and OpenAI keys. It is **not** shown to share a cause with the classic editor's media-worker error. Differences: it appears in a different application and dialog, in the key-validation step; its HTML starts with uppercase `<HTML><HE...` (typical of a gateway or proxy error page), whereas the classic dev server's fallback is lowercase `<!doctype html>`. The wording is the generic message JavaScript produces whenever `JSON.parse` receives HTML, so it says nothing about the source. I have not reproduced it and have not looked at that code path. It needs its own investigation with the failing request's URL, status and body from a deployed instance.

## New editor: layout, tracks, controls, panels (recorded from the running app and source)
- **Shell**: header "TIMELINE STUDIO EDITOR", home button, six top tabs **Elements, Spaces, Director, Edit, LLM, Export**; right side: settings, voice director, AI assistant. Left collapsible sidebar with an assistant prompt box and Cloud/Local switch on non-Edit tabs. Project Manager (list/grid, New Project, Open, Export/Import) before the workspace.
- **Edit tab**: left **Media Pool** (grid/list, search, import and folder icons, sort, size slider, Compact toggle; shows the Timeline entry and imported assets with badges such as VISION/TRANSCRIBING); centre **Timeline Viewer** (single or dual viewer, inspector toggle, playback mode Auto, go-to-start, step back, play, step forward, go-to-end, timecodes); lower **Timeline** with tool column, timeline tabs ("Timeline 1", "+ New Timeline"), "+ Add overlay..." lane, tracks **Video 1** and **Audio 1** (lock, M, S per track), "+ Add Track", Snap (ON), Marker, zoom sliders. Right **inspector** (Transform: Flip H/V; Speed; Opacity; Effects with Browse library; LUT/Look; Blend; Analyze) when a clip is selected. The Browse library shows **33 effects, 16 LUTs and 16 transitions**.
- **Tools** (from tooltips): Selection (V), Blade (B), Ripple Trim (R), Roll Trim (N), Slip (Y), Slide (U), Music Tool (M), Fill Gap (G), Extend (E), Mask (X), sound effects library, record voice-over.
- **Director tab**: Shotlist / Storyboard / Generate / Setup, look bible, LLM for breakdown, aspect ratios 16:9, 9:16, 1:1, 21:9, 4:3, resolutions 480p, 720p, 1080p, genre chips, screenplay/beat-sheet upload. **Spaces**: canvas/studio/sets, zoom, fit view. **Elements**: Characters, Locations, Props, Vehicles, List Builder, Lead Generator, folders. **LLM**: prompt box with starter prompts. 
- **Export tab**: presets Draft 720p / Standard 1080p / High Quality 4K, frame rate (24/30/60), aspect ratio and fit, video bitrate, "Master quality" option, "Check the finished export" option (on by default), RENDER, Export FCPXML, interactive-video share.
- **Keyboard shortcuts** (from `src/cinegen/components/edit/edit-tab.tsx` and `timeline-editor.tsx`): Space play/pause; Left/Right arrow step one frame; V, A (track forward), B, Y, U, R, N, G, E, X select tools; Delete or Backspace removes selected clips; Ctrl/Cmd+L link/unlink; Ctrl/Cmd+Shift+Space quick edit with AI; Escape closes menus; Enter/Escape in rename fields. Shortcuts are ignored while typing in inputs.
- **Export behaviour**: in-browser render, no FFmpeg, no server; progress shown as a percentage; the finished file downloads automatically as `cinegen-export.mp4`; the editor then runs its own check (duration, size, black/frozen frames, silence, peak level).
- Evidence: `evidence/new-editor-capture-log.json`, `evidence/baseline-new-*.jpg`, `evidence/classic-controls.json`.

## NOT completed (stated plainly)
- A classic-editor export that contains real media: **NOT TESTED** (pre-existing missing `media-worker.js` and MediaInfo WASM in dev; not worked around in app code).
- Scripted editing beyond import, drag-to-timeline, snap and export (cuts, effects, transitions, overlays): **NOT TESTED**.
- No before/after screenshot comparison is possible yet because no app file has changed (the diff is empty). A re-capture after any future integration is still required.
