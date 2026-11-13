# Stage 1 report: CineGen pre-work + editing foundations

Branch `claude/focused-brown-9xfv3c`. Scope: CineGen only (`src/cinegen/`, route `#/timeline`). The classic editor, Remotion web renderer,
player, publishing, analytics and auth/RLS were not touched. No new dependency, service, player or renderer.

## Part A: preview-vs-export hand-off (commit `63e69b545`)

Each gap was verified from code first. `PlaybackEngine` is the preview; export goes `export-tab` -> `adapters/web-api.ts` ->
`timelineToComposition` -> `TimelineComposition`. Before this work the export state had one `v` and one `a` track with no mute/solo/volume,
and clips carried no opacity or flip.

| Gap | Verified | Result |
|---|---|---|
| Track mute / solo | Not sent (tracks in export state had no `muted`/`solo`) | Fixed. Same rule as `PlaybackEngine.updateMutedTracks`. Note the preview drops a muted track's clips entirely (picture and sound), so export does the same. |
| Track volume | Not sent | Fixed for audio-kind tracks (the preview only applies track volume there). |
| Track visibility | `track.visible` is only a UI flag; the preview engine ignores it | Export now honours it (hidden video track: picture dropped, sound kept). **The preview still does not hide it**, so this is a new, documented preview/export difference. |
| Clip volume above 1 | Preview boosts with WebAudio gain; the composition clamps volume to 1 | Handled consistently: export caps at 100% and reports a warning in the render panel (`job.warnings`). No boost in export. |
| Static opacity, flipH/flipV | Not sent | Fixed. Flip goes as `flip` on the layer; static opacity as a constant opacity keyframe track (opacity keyframes still win, as in the preview). |
| Plain dissolve / fadeToBlack / fadeFromBlack | Only GL transitions (`glType`) were sent | Fixed as opacity ramps matching `applyTransitionOpacity` (A fades out, B fades in over the overlap). It is the preview's opacity model, not a true compositing cross-dissolve. GL transitions are unchanged. |
| Stacking order | All video clips shared one composition track | One composition track per CineGen track, so V2 stays above V1 as in the preview. |

New pure module `src/cinegen/lib/editor/export-mapping.ts` (also holds the export item builder moved from `web-api.ts`).
Tests: `src/cinegen/__tests__/editor/export-mapping.test.ts` (13 tests) build timelines with the real timeline operations, go through the real
`timelineToComposition`, and assert composition props (`flip`, `keyframes.opacity`, `audio[].volume`, layer order, missing layers).

## Part B: Stage 1 features

Pure logic in `src/cinegen/lib/editor/stage1/` (`source-range`, `edit-ops`, `groups`, `compound`, `speed-ramp`, `shuttle`); wiring in
`components/edit/use-stage1-editing.tsx` (one hook), `source-marks.tsx`, small edits to `edit-tab.tsx`, `source-viewer.tsx`, `export-tab.tsx`.

| Feature | Status | Where the user finds it |
|---|---|---|
| Insert edit | Done | Double-click a media-pool asset (opens the Clip Viewer), mark range, move the timeline playhead, press **Insert** or `,`. Ripples every unlocked track, splits straddling clips, moves markers, places linked audio. |
| Overwrite edit | Done | Same panel, **Overwrite** or `.`. Replaces what is under the range on the target track (and its linked audio track). |
| Mark in / out + source monitor | Done (session state) | The Clip Viewer already existed; it now shows an in/out strip for a media-pool asset. `I`, `O`, `Alt+X` (clear). Marks live in memory for the session and are not saved in the project. Not done: timeline in/out points, track patching UI (target track = selected clip's track, else first unlocked track of the right kind). |
| J / K / L shuttle | Done | `L` forward 1/2/4/8x, `J` reverse, `K` stop, hold `K` + `J`/`L` = frame step. Forward up to 4x uses the engine; reverse and 8x move the playhead (no audio). Readout in the "Clip tools" bar. |
| Timeline markers | Already existed (Marker button, ruler flags). Not reimplemented. | Timeline tab bar |
| Timecode HH:MM:SS:FF | Already existed (`time-ruler.tsx formatTimecode`), but it is fixed at 24 fps rather than the project's fps. Unchanged (limitation). | Ruler, viewers |
| Clip grouping | Done | Select clips, `Ctrl+G` / Group; `Ctrl+Shift+G` / Ungroup. Selecting one member selects all, and the existing multi-select move / delete / duplicate paths act on the group. Stored as `Clip.groupId` (not as link, because `splitClip`/`trimClip` apply to all linked clips and would corrupt a group). |
| Compound clips | Done, with limits below | Select clips, **Nest** (`Ctrl+Alt+G`); **Expand** (`Ctrl+Alt+Shift+G`). One clip object (`Clip.compound`); playback engine and export receive `flattenCompounds(timeline)`, so there is no second renderer. Move, trim, split, speed and static opacity/volume/flip of the compound are honoured. |
| Rate stretch / constant speed | Already existed (Alt-drag edge, `speed` 0.1 to 8). Not reimplemented. | Timeline |
| Speed ramp | Partial | "Speed ramp" list in the Clip tools bar (4 presets). Realised as a **stepped** ramp: the clip is cut into 8 pieces with constant speeds, because the preview and Remotion export both play one constant speed per clip. No curve editor, no custom points UI. Undo restores the clip. |
| Multiple sequences | Already existed (`timelines[]`, tabs: create / rename / duplicate / delete / switch). Not reimplemented. | Timeline tabs |
| Ripple / roll / slip / slide / linked / undo | Already existed. Added one real-data cross-check test (handles, positions, totals). | n/a |

### Limits of what shipped
- Compound: the compound's own keyframes, fades, fx, LUT, blend, transform, zoom and captions are not applied to its content; transitions between a nested and a non-nested clip are removed on nesting (the user is told); a transition on the compound itself is dropped in the flattened view; the compound sits on one track (the top video track of the selection) while its audio/video children keep their own tracks on flatten. In the Electron-native visual path, transitions between nested clips are not shown (the web path is the product).
- Insert/overwrite do not move overlay-lane items or captions (they are outside `Timeline.clips`).
- Overwrite across a dissolve: transitions on removed clips are dropped; an end transition follows the surviving tail piece.
- Duplicate timeline (existing code) regenerates clip ids but leaves `linkedClipIds` pointing at the old ids. Seen while reading, not changed.
- Persistence: web projects default to `storage=db`, which uses `db-converters.ts`; a `stage1_json` field carries `groupId` + `compound` there (round-trip tested). The JSON path keeps unknown fields as they are.

## Upstream reuse
None. FreeCut `in-out-points.ts` and `source-calculations.ts` work on frame-based timeline items, and `slip`/`slide` duplicate CineGen's existing, tested
`timeline-operations.ts`; writing seconds-based helpers was smaller than adapting them. No file from FreeCut (commit
`5ceeeb388eef5423640b7db157706274bf1b8165`, MIT) was copied, and nothing from the LGPL `time-stretch.ts`.

## SmartVideo files modified
`src/cinegen/adapters/web-api.ts`, `components/export/export-tab.tsx`, `components/export/render-progress.tsx`, `types/export.ts`, `types/timeline.ts`,
`electron.d.ts`, `lib/db-converters.ts`, `lib/help/help-content.ts` (help for the new controls; a test requires it), `components/edit/edit-tab.tsx` (+14 lines),
`components/edit/source-viewer.tsx` (+9 lines). New: `lib/editor/export-mapping.ts`, `lib/editor/stage1/*`, `components/edit/use-stage1-editing.tsx`,
`components/edit/source-marks.tsx`, tests, `docs/stage-1/smoke/*`. Not touched: `timeline-editor.tsx`, `playback-engine.ts`, `TimelineEditorPage.jsx`,
`addons/*`, `WatchPage.jsx`, `interactivePlayer.js`, `publishClient.js`, analytics, migrations.
`timeline-parity` budget: `edit-tab.tsx` now 242/260 lines; `timeline-editor.tsx` unchanged at 224/220 (the baseline failure).

## Tests actually run
- Baseline before changes: `npx vitest run src/cinegen` = 1 failed, 1386 passed, 27 skipped (the `timeline-editor.tsx` parity budget, 224 > 220).
- New: `export-mapping.test.ts` 13 tests, `stage1.test.ts` 21 tests (marks, insert incl. linked audio / markers / locked track / dissolve handling, overwrite, undo/redo snapshots, group,
  compound nest/flatten/expand incl. trim/speed/nesting/export clip list, speed ramp coverage/ripple/keyframes/fades/export speeds, shuttle, cross-check of ripple/roll/slip/slide,
  JSON + migration + row-converter round trips).
- Final full run `npx vitest run src/cinegen`: see the numbers recorded at the bottom of this file.
- ESLint (with `NODE_OPTIONS=--max-old-space-size=8192`, it runs out of memory otherwise) on all changed and new files: 0 errors (warnings are pre-existing style warnings plus unused-parameter warnings on type signatures).
- Type check: whole-project `tsc` stops on pre-existing syntax errors in `packages/tokens/src/index.ts`. A scoped `tsc` over the new modules found two real
  type errors in my code (fixed); the remaining output was pre-existing (`NodeJS` namespace in `export-tab.tsx`) or caused by the scoped config's ES2020 lib (`Array.prototype.at`, already used elsewhere in the app).
- Browser smoke (Playwright with the pre-installed Chromium via `executablePath`, vite dev server on :3100, real `#/timeline`, real imported mp4):
  PASS: source monitor shows marks strip; `I`/`O` set marks; Insert places the clip (video + linked audio); undo removes it and redo restores it; `L`,`L`,`K`,`J` change the shuttle readout (1x, 2x, stop, reverse 1x);
  `Ctrl+G` groups; Nest -> 1 compound clip rendered in the viewer while playing; Expand -> 2 clips; Speed ramp -> 16 clips, undo -> 2; Overwrite places the range.
  Script: `docs/stage-1/smoke/stage1-smoke.cjs` (needs a `clipA.mp4`). One earlier run needed a second `Ctrl+Z` before the insert disappeared; later runs needed one. Cause not isolated.
  **Not run in a browser:** moving or deleting a grouped pair (covered by unit tests of selection expansion and moveClip, and by the existing multi-select code, but not clicked through), and a real Remotion web export of a compound / ramped / opacity timeline (covered at the composition-model level only).

## Final test numbers
`npx vitest run src/cinegen` after all changes: **Test Files 1 failed | 199 passed (200); Tests 1 failed | 1420 passed | 27 skipped (1448)**.
The one failure is the baseline `timeline-parity` budget for `timeline-editor.tsx` (224 > 220), identical to before; baseline was 1386 passed, so +34 passing tests
(13 + 21), nothing regressed. (A mid-way run also failed `help-coverage` until the new controls got help entries; fixed.)
