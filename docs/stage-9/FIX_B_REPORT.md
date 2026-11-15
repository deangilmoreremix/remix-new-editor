# Fix B report: persistence, marks and range, scene worker, line captions

Worktree branch `claude/focused-brown-9xfv3c-fixB`. CineGen only (`src/cinegen`, plus the vendored caption renderer in `src/openchatcut/captions`).
Everything below was run in this session unless marked **not run**. Smoke scripts are in `docs/stage-9/smoke/`, their output in `docs/stage-9/smoke/results/`.
Browser: Chromium 153 headless (`/opt/pw-browsers/chromium-1243`), vite dev server on :3100 with a private `cacheDir` (the shared `node_modules/.vite` is used by other
agents and caused `504 Outdated Optimize Dep` during the first export attempts; the config used is a 3-line wrapper outside the repo).

## 1. Imported local media survives a reload

| Change | Where |
|---|---|
| IndexedDB blob store keyed by asset id (`LocalBlobStore`, injectable backend) | new `lib/media/local-blob-store.ts` |
| `persistLocalMedia` on import / recording / relink, `restoreLocalMedia` on project load (both hydration paths) | new `adapters/local-media-restore.ts`; one line each in `web-media.ts`, `media-health.tsx`, `workspace-shell.tsx` |
| Cleanup | entries of a deleted project removed (`web-store.ts`); on load, entries of this project whose asset is gone and unused for 7 days are pruned (grace so undo still has its media) |
| Quota | a failed write evicts entries unused for a week once and retries; if it still fails the file works for the session, a console warning and a `cinegen:local-media` window event (`persist-failed`) are emitted, nothing throws. Restore failures (`missing`) and successes (`restored`) emit the same event |

Evidence:
- Unit tests `__tests__/fixb/local-blob-store.test.ts` (3): restore of dead blob URLs vs live / remote URLs, quota eviction + retry + failure result, prune / removeProject (fake backend, real Blobs).
- Browser `fixb-persist.cjs` (real `#/timeline`, real 6 s mp4 from ffmpeg, Add video): the blob store holds the file, project autosaves, **page reload**, the project reopens by itself, the clip is on the timeline, a `<video>` has a live restored `blob:` URL (readyState 4, duration 6 s), Media health "Check media" says 0 of 1 sources missing, and a real export (Remotion web renderer) after the reload produced an mp4 (video 2.000 s + audio, mean luma 121, so not black). No relink step anywhere. Output: `results/fixb-persist.txt`.

Limits: stored per browser profile (not synced; a cloud-signed-in upload still gives a durable https URL as before and is preferred when it works). A file larger than the browser quota is not kept (reported as above). Clearing site data loses the files (the old relink flow still applies; the restore reports `missing`). Proxies are not persisted (a dead `proxyRef` is dropped and can be regenerated). Writes are asynchronous: closing the tab within a second of an import can lose that file's copy.

## 2. Source marks persisted; timeline in/out

- Source-monitor marks are saved in `asset.metadata.sourceMarks` (`lib/editor/range/source-marks-persist.ts`; saved through `UPDATE_ASSET`, whose reducer deep-merges metadata; validated against the asset duration on read). `use-stage1-editing.tsx` reads and writes them; the Stage 1 UI and keys are unchanged.
- Timeline range: `Timeline.range?: {in, out}` (one optional field in `types/timeline.ts`), persisted as `range_in` / `range_out` next to `master_volume` (one line each in `db-converters.ts` and `workspace-shell.tsx`). Pure logic in `lib/editor/range/timeline-range.ts`.
- Keys: **I / O act on the timeline when the timeline (ruler, tracks, bottom bar) was the last thing clicked, or when no source asset is open; otherwise they set the source marks exactly as in Stage 1.** Alt+X clears the same target. The Stage 1 bar gets In / Out / Clear buttons, a Loop checkbox, a readout and a small range strip.
- Loop: while playing, the playhead jumps back to the range start when it passes the end.
- Export range: `export-tab.tsx` runs `applyExportRange(flattenCompounds(timeline), range)`: clips are cut at both points with the editor's own `splitClip` (keyframes, anim keys and linked audio sliced as for a manual razor cut), outside clips dropped, everything moved to start at 0; overlay-lane items and markers are clipped / shifted the same way. Edit-tab not touched (parity budget unchanged).
- Evidence: `__tests__/fixb/range-and-marks.test.ts` (7 tests: in/out ordering, loop target, a 2..7 s cut of a three-clip timeline with linked audio and keyframes checked value by value, a 2x speed clip, overlays, marks round trip). Browser `fixb-persist.cjs`: marks set with I / O on the source monitor and a range set with I / O after clicking the ruler (1 s to 3 s) both unchanged after reload, the timeline keys do not touch the source marks, and the real export after the reload is **2.005 s** for a 6 s clip (range 1 s to 3 s).
- Stage 1 rerun (`results/fixb-stage1-stage4-rerun.txt`): all Stage 1 smoke checks PASS (marks, insert, undo / redo, JKL, group, nest / expand, ramp, overwrite).

Limits: no range shading on the ruler itself (that would touch `timeline-editor.tsx`, over its parity budget); the strip and readout are in the Stage 1 bar. Loop is seek-based (a small hitch at the wrap). Compound clips are flattened before the cut, so a range cuts inside them. Transitions whose clips are split by the range are dropped; translated caption cues (absolute ms) and tracked-transform paths are not shifted; mg-template overlay props that depend on absolute time are not adjusted. Loop and range are not applied to the Director / other tabs.

## 3. Scene scan in a Web Worker

- `lib/scenes/scan-core.ts` (the unchanged algorithm, now over any `VideoSampler`), `scan-worker.ts` (WebCodecs through mediabunny `CanvasSink` on OffscreenCanvas, JPEG thumbnails via `convertToBlob`), `scan-worker-client.ts` (one worker per scan, progress forwarded, abort posts `cancel` and terminates the worker). `scanScenes` uses the worker when `Worker`, `OffscreenCanvas` and `VideoDecoder` exist and **falls back to the main-thread `<video>` sampler** if the worker cannot run (`useWorker:false` forces it). Same signature, same results type.
- Evidence (`fixb-scenes.cjs`, real mp4 with three hard cuts): worker scan finds 4 scenes with cuts **2.000 / 4.400 / 6.000 s**, identical to the main-thread scan (agreement within 0.05 s, in fact equal); every scene has a JPEG thumbnail; 168 progress events, non-decreasing, all three phases; exactly one Worker created and terminated after a cancel (`AbortError`); an already-aborted signal starts no worker; a bad URL rejects. The old `stage4-lib-browser.cjs` and `stage4-ui-smoke.cjs` pass unchanged (they now go through the worker path; the scene browser UI shows 4 scenes).
- Honest numbers: on this 8 s 320x180 clip the worker scan took 939 ms and the main-thread scan 1003 ms, and the longest main-thread timer gap was 14 ms in both (the old loop already yields every 8 frames and the frames are tiny). The benefit is for large frames / long videos, where decode and `getImageData` no longer compete with the UI; **not measured on such media**.

Limits: needs WebCodecs (Chromium, recent Safari / Firefox); a codec WebCodecs cannot decode falls back to the main thread. Frame choice comes from the decoder (last frame at or before the time) instead of a `<video>` seek; cuts matched on the test clip, other media may differ by a frame.

## 4. Per-line caption motion

- New presets `line-rise` and `line-fade` (`CaptionMotionPreset`, `TEXT_MOTION_PRESETS` with `unit: 'line'` for the existing pure evaluator, Caption motion dropdown). `openchatcut/captions/captionLines.ts` groups a page's words into lines with the same 24-character budget the paginator uses and gives each word its line's start time; `captionWordMotionStyle` takes that as an optional 4th argument and `CaptionsLayer` passes it (so the preview player and the Remotion export, which share `CaptionsLayer`, behave identically). Pure function of timeline ms, no clock or random.
- Evidence: `__tests__/fixb/caption-line-motion.test.ts` (4 tests, exact styles at chosen ms, line grouping, determinism). Browser `fixb-captions.cjs`: the real `CaptionsLayer` in a Remotion Player `Thumbnail` at chosen frames (nothing before 500 ms; 33 ms into line 0 both its words at opacity 0.4216 with `translateY`; line 0 settled while line 1 hidden; line 1 rising from its own start 1100 ms; frame revisited out of order identical; `line-fade` changes opacity only), and the real **`renderMediaOnWeb` export** (h264 mp4, 3 s) decoded with ffmpeg: caption area has 0 bright pixels at 0.3 s, 965 at 0.9 s (line 0 only), 1831 at 1.6 s (both lines). Two renders gave the same file size (32601 bytes).

Limits: lines are an estimate from the character budget (as the paginator's), not measured layout, so a very wide font can wrap differently on screen than the grouping assumes (the animation still stays deterministic). Not run: a full app export of a clip with transcript-driven captions using the new presets (the app path shares `CaptionsLayer`; the harness exercised that component through the same web renderer).

## Test status

`npx vitest run src/cinegen src/openchatcut`: 2 failed before my last fix, **1 failed | 1673 passed | 30 skipped** after: the failure is the unchanged `timeline-editor.tsx` parity budget (228 > 220, identical with my changes stashed). The first run also caught a new hover-help coverage failure for a `title` I added; fixed. ESLint on all changed / new TS files: 0 errors, 53 warnings (`no-unused-vars` on type-signature parameter names, the same pattern as existing files). **Not run:** a repo-wide `tsc` (it stops on syntax errors in unrelated `apps/director` files), so the new code is type-checked only by vite / vitest transpilation.

## Files

New: `lib/media/local-blob-store.ts`, `adapters/local-media-restore.ts`, `lib/editor/range/{timeline-range,source-marks-persist}.ts`, `lib/scenes/{scan-core,scan-worker,scan-worker-client}.ts`, `openchatcut/captions/captionLines.ts`, tests `__tests__/fixb/*`, `docs/stage-9/smoke/*`.
Edited (small): `types/timeline.ts` (+2), `db-converters.ts` (+1), `workspace-shell.tsx` (+4), `export-tab.tsx`, `use-stage1-editing.tsx`, `web-media.ts` (+3), `web-store.ts` (+2), `media-health.tsx` (+2), `scan-video.ts`, `text-motion.ts`, `captionMotion.ts`, `CaptionsLayer.tsx`, `types.ts`, `clip-captions-section.tsx` (one list). `edit-tab.tsx`, `export-mapping.ts` not touched.
