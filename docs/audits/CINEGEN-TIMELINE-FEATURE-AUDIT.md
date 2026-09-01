# CineGen Timeline Feature Audit

Status as of Batch 1 implementation on `feature/timeline-fill-gap-extend`.

## Fill Gap

Status: IMPLEMENTED — NOT VERIFIED

Changes:
- Removed fake `local-fallback` success path from `src/components/modals/FillGapModal.jsx`.
- Added real implementation in `src/lib/editor/timelineAI.js`:
  - `findClipGap()` detects the gap after the selected clip on its track.
  - `getFillGapBoundaryFrames()` captures last visible frame of left clip and first visible frame of right clip.
  - `executeFillGap()` sends real provider request via `runCineGenTool(CINEGEN_TOOLS.FILL_GAP, ...)`.
  - `applyFillGapResult()` persists generated asset via `assetStore.saveAsset()`, inserts clip exactly into the gap, and trims to fit.
- Provider failure now surfaces as failure; no generated clip appears on failure.
- Missing provider returns `{ success: false, code: 'PROVIDER_NOT_CONFIGURED', ... }`.

Unit tests: `src/test/timelineAI.test.js` covers gap calculation, neighbor detection, locked track, no-gap cases, and clip insertion.

Browser test: Not yet verified in Playwright.

Live provider: Not tested in this batch.

## Extend

Status: IMPLEMENTED — NOT VERIFIED

Changes:
- Removed fake `local-fallback` success path from `src/components/modals/ExtendModal.jsx`.
- Added real implementation in `src/lib/editor/timelineAI.js`:
  - `getExtendBoundaryFrame()` captures boundary frame for after/before extend.
  - `executeExtend()` sends real provider request via `runCineGenTool(CINEGEN_TOOLS.EXTEND, ...)`.
  - `applyExtendResult()` persists generated asset, inserts after or before source clip, handles collision by shifting downstream clips.
- Provider failure surfaces as failure; no fabricated footage.
- Locked track is respected.

Unit tests: `src/test/timelineAI.test.js` covers insert and shift helpers used by extend.

Browser test: Not yet verified in Playwright.

Live provider: Not tested in this batch.
