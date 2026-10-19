# SmartVideo Timeline Studio — Production Recovery Baseline

Date: 2026-08-30

Recovery branch: `recovery/timeline-production-20260830`

Baseline SmartVideo commit: `40bc3637b81de5c6a455b41c23fe1b9dbf0ae4be` (`develop` at branch creation)

## Safety decision

Timeline recovery is isolated on a new branch created directly from the current SmartVideo `develop` head. The divergent `fix/security-and-stability` branch is not being merged, rebased, or used as the recovery base because its repository state is not a safe SmartVideo baseline.

No production/develop branch was modified by creating this recovery branch.

## Historical recovery findings

Timeline functionality has multiple implementation generations and must be recovered subsystem-by-subsystem rather than by blindly reverting or cherry-picking an old integration.

Key commits identified:

- `3e7802a82c7ca84347023a43daa24248ca4e1503` — earlier Timeline feature integration including professional editing tools, track management, music, audio sync, Fill Gap, Elements, Dual Viewer, and Proxy Mode.
- `bfa632cd55c8d6421e8f42807393f75fa0e95ec2` / related August work — newer Timeline data-model bridge work.
- `ca40ce4c39a62b6ae877da88957dc144fa705038` — reverted `TimelineEditorPage.jsx` to a pre-merge version to resolve build/syntax failures. This commit must not be blindly reverted.

## Current stop-ship defect

`src/components/TimelineEditorPage.jsx` contains this corrupted/commented import:

```js
// MARKER_TEST_ABC123import { processFileUpload } from '../lib/editor/uploadPipeline.js';
```

The page later calls `processFileUpload(...)`, so local media import can fail at runtime because the symbol is not imported.

The corruption predates `ca40ce4c...`; undoing that rollback alone will not fix this defect.

Correct target import:

```js
import { processFileUpload } from '../lib/editor/uploadPipeline.js';
```

## Upload-pipeline assessment

`src/lib/editor/uploadPipeline.js` is a substantive implementation and should be preserved. It currently covers:

- file validation;
- metadata extraction;
- provider upload with retry handling;
- thumbnail generation;
- canonical asset creation;
- timeline clip insertion;
- media-library insertion;
- undo snapshots;
- persistence;
- UI refresh/error reporting;
- multiple-file uploads;
- URL/cloud import support.

The first recovery action should therefore repair wiring and test it rather than replace the upload pipeline.

## Existing upload tests

`tests/unit/timeline-upload-pipeline.unit.spec.ts` already exercises core upload-pipeline behavior, including canonical assets/clips and insertion. Additional page-level wiring and browser E2E coverage is still required.

## CI baseline

`.github/workflows/ci.yml` runs on pull requests targeting `develop` or `main` and currently checks:

- root/backend/director lint;
- TypeScript typecheck;
- root and backend tests;
- root and director builds;
- backend dependency audit.

At this baseline there was no status/workflow result attached to the `develop` commit used to create the recovery branch. A draft recovery PR should therefore be used to establish actual CI results.

The current CI does not contain the dedicated Timeline Playwright smoke suite required for production certification.

## Production-code concerns found during baseline inspection

The current Timeline page contains a mixture of real integrations and incomplete/placeholder behavior. These must be audited and converted to real functionality rather than hidden or deleted. Baseline examples include:

- AI-assistant actions that report `functionality to be implemented`;
- sample subtitle fallback behavior;
- simulated generation paths;
- hard-coded analysis success text;
- decorative/random waveform rendering;
- CineGen-labelled compatibility/tool paths that still require SmartVideo-native backend verification;
- duplicate/legacy helper implementations;
- mixed legacy `state.tracks` / `state.project.tracks` / newer Timeline-model usage.

No item above should be declared production ready until its applicable UI/state/backend/media/timeline/persistence/Playwright gates are verified.

## Initial recovery sequence

### Wave 1 — Baseline and local-media stop-ship

1. Fix the corrupted `processFileUpload` import without rewriting Timeline architecture.
2. Verify upload-button, drag/drop and multi-file paths all route through the unified pipeline.
3. Add/repair focused tests for video, image, audio, multiple files, invalid files, timeline insertion and save/reload wiring.
4. Establish actual lint/typecheck/unit/build baseline through CI.
5. Add a minimal Timeline Playwright studio-load/media-import smoke path before calling Wave 1 complete.

### Wave 2 — Core professional editing tools

Audit current Select, Blade, Ripple, Roll, Slip and Slide implementations against the current Timeline model and historical implementations. Recover/wire existing services; do not replace working lower-level services.

### Wave 3+ — AI/backend/media recovery

Continue in controlled waves for typed Timeline AI transport, Fill Gap, Extend, Music, Dual Viewer, Masking, Audio Sync, Proxy, Elements, Shot Board, Composition Plan, multiple timelines, AI Assistant, real export, persistence/undo/error hardening, Playwright, and documentation.

## Baseline production-readiness status

| Area | Baseline status | Notes |
| --- | --- | --- |
| Timeline page loads | Unverified | Browser/E2E proof required |
| Local media import | Blocked | `processFileUpload` import is commented/corrupted |
| Upload pipeline implementation | Present | Real implementation found; wiring regression must be repaired |
| Upload unit tests | Present | Additional integration/E2E wiring tests needed |
| Core NLE tools | Audit required | Multiple historical/current implementations exist |
| AI tools | Not certifiable | Placeholder/simulated/disconnected paths found |
| Subtitles | Not certifiable | Sample fallback must not masquerade as production transcription |
| Waveform | Not certifiable | Decorative/random waveform path found in current page |
| Export | Audit required | Must prove real playable media output |
| Persistence | Audit required | Must verify save → refresh → reopen for each major feature |
| Timeline Playwright suite | Missing/incomplete | Required before production readiness |

## Non-destructive rules for all following commits

- Preserve working SmartVideo features.
- Never solve build/test failures by deleting Timeline functionality.
- Never replace real processing with mocks/placeholders in production.
- Never blindly replay the old CineGen integration.
- Adapt recovered functionality to the current SmartVideo Timeline architecture.
- Do not push changes directly to `develop` or deploy until recovery gates pass.
