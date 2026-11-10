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

## NOT completed (stated plainly)
- A real MP4 export from either editor was **not** produced. Both need a project with media (no media in this environment, and media/AI generation needs the user's own API keys). Status: **NOT TESTED**.
- Editing behaviour was inventoried (controls, tabs) but no scripted editing session was recorded.
- No before/after screenshot comparison is possible yet because no app file has changed (diff is empty). A re-capture after any future integration is still required.
