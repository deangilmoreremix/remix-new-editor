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

## Export behaviour (read from source, not executed end to end)
- Classic editor: `timelineToComposition()` model -> `exportClient.js` -> sandboxed `export-runner` iframe -> `renderMediaOnWeb` (WebCodecs), download as blob.
- New editor: `src/cinegen/adapters/web-api.ts` `export.start` builds the same model with the same `timelineToComposition.js` and `exportClient.js`, so it also renders in the browser with no FFmpeg and no server. Its Export tab then runs an in-browser QA pass.

## Real exports from both editors (VERIFIED; scripts `baseline/classic-import.mjs`, `baseline/new-import.mjs`)
Sample media: a 6 s 1280x720 clip built from the images you attached (3 images x 2 s) with a 1 s beep tone. No API key was needed.

| | Classic editor (this branch) | New editor (`confident-fermi`) |
|---|---|---|
| Media in the export | **No**: the sample import did not reach the timeline (see below), so this is the built-in 45 s placeholder project (the dialog warns "the background will be black") | **Yes**: sample imported, dragged onto Video 1 with its linked audio |
| Export settings | MP4 H.264, 720p | Draft 720p |
| Result | 1280x720, H.264, 1350 frames, 45.0 s, AAC 45.01 s | 1280x720, H.264, 195 frames, 6.5 s, AAC 6.51 s |
| Evidence | `out/baseline-classic/classic-export-720p-empty.mp4` | `out/baseline-new-import/new-editor-export-720p.mp4` |
| Editor's own check | n/a | "0 errors, 3 warnings": still/frozen spans (expected: the sample is three still images), peak -2.1 dBFS |
| Independent check | frame/audio durations match the 45 s timeline | image order correct; video image boundaries and audio beeps both sit exactly 0.5 s later than in the source (the clip was dropped 0.5 s into the timeline), so **audio and video stay in sync** |

Why the classic import did not land: `src/lib/media-worker-manager.js` fetches `./lib/media-worker.js`, which **does not exist in this repo** (the repo's own `e2e/upload-boundary.spec.js` documents this and stubs it); the dev server answers with the HTML fallback, which is the `SyntaxError: Unexpected token '<'` seen in the console. With the same stub applied through request interception, the worker error disappears, but the metadata library's `MediaInfoModule.wasm` is also served as HTML in dev, so the clip is not added. This is a **pre-existing** issue on that branch, not caused by this work, and it was not changed. The same "Unexpected token '<' ... is not valid JSON" wording as in your SmartVideo GO key-dialog screenshot means an HTML page came back where JSON was expected; that screenshot's HTML starts with uppercase `<HTML><HE`, which looks like a gateway or proxy error page rather than the dev server's fallback, but I have not reproduced or diagnosed the GO case.

Other pre-existing observations on the new-editor branch: `[popcorn-init]` and `[ModalSystem]` module errors on load (`templateGenerator.js` does not provide an export named `entitie...`).

## NOT completed (stated plainly)
- A classic-editor export that contains real media: **NOT TESTED** (blocked by the missing worker file and wasm in dev).
- Scripted editing beyond import, drag-to-timeline and export: **NOT TESTED** (controls and tabs were inventoried only).
- No before/after screenshot comparison is possible yet because no app file has changed (the diff is empty). A re-capture after any future integration is still required.
